/**
 * Browser auth: the Supabase client and the nine names the app imports.
 *
 * Same surface as src/auth.js (supabase, AuthProvider, useUser, useAuth,
 * useSignIn, useSignUp, useAuthActions, SignedIn, SignedOut) with the same
 * return shapes. What changed inside: the session now lives in cookies
 * (@supabase/ssr) instead of localStorage, so proxy.ts and Server Components
 * can verify it, and OAuth uses PKCE.
 *
 * Server code must not import this module for auth decisions; it uses
 * getClaims() from lib/auth/server.ts.
 */
'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { trackSignUp } from '@/lib/analytics';
import { identifyUser, resetObservability } from '@/lib/observability';
import { AUTH_NEXT_COOKIE, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/auth/config';

export { AUTH_NEXT_COOKIE } from '@/lib/auth/config';

const MISSING_ENV =
  'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY';

function missingEnvClient(): SupabaseClient {
  // Throwing at import time would take down every page in a build without the
  // env; throwing on first use points at the actual caller instead.
  return new Proxy({} as SupabaseClient, {
    get() {
      throw new Error(MISSING_ENV);
    },
  });
}

export const supabase: SupabaseClient =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: true,
          // The /sso-callback route handler exchanges the code server-side and
          // sets the cookie. Letting the browser client also exchange it would
          // race it for the one-time code verifier.
          detectSessionInUrl: false,
        },
      })
    : missingEnvClient();

/** The user shape every component reads (unchanged from the CRA app). */
export interface AppUser {
  id: string;
  user_id: string;
  email: string | undefined;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  image_url: string | null;
  picture: string | null;
  app_metadata: User['app_metadata'];
  user_metadata: User['user_metadata'];
  external_accounts: Array<{ provider: string }>;
  identities: NonNullable<User['identities']>;
}

interface AuthState {
  session: Session | null;
  user: AppUser | null;
  isLoaded: boolean;
  isSignedIn: boolean;
}

const AuthContext = createContext<AuthState | null>(null);
let pendingOtpEmail: string | null = null;

function metaString(meta: Record<string, unknown> | undefined, key: string): string | null {
  const value = meta?.[key];
  return typeof value === 'string' && value ? value : null;
}

function mapUser(user: User | null | undefined): AppUser | null {
  if (!user) return null;

  const identityProviders = Array.isArray(user.identities)
    ? user.identities.map((identity) => identity.provider)
    : [];
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const fullName = metaString(meta, 'name');

  return {
    id: user.id,
    user_id: user.id,
    email: user.email,
    first_name:
      metaString(meta, 'first_name') ||
      metaString(meta, 'given_name') ||
      fullName?.split(' ')?.[0] ||
      null,
    last_name: metaString(meta, 'last_name') || metaString(meta, 'family_name') || null,
    name: fullName || user.email || null,
    image_url: metaString(meta, 'avatar_url') || metaString(meta, 'picture') || null,
    picture: metaString(meta, 'avatar_url') || metaString(meta, 'picture') || null,
    app_metadata: user.app_metadata || {},
    user_metadata: user.user_metadata || {},
    external_accounts: identityProviders
      .filter((provider) => provider && provider !== 'email')
      .map((provider) => ({ provider })),
    identities: user.identities || [],
  };
}

function rememberNext(path: string | null | undefined): void {
  if (!path || typeof document === 'undefined') return;
  // Only same-site paths: this value becomes a redirect target.
  if (!path.startsWith('/') || path.startsWith('//')) return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${AUTH_NEXT_COOKIE}=${encodeURIComponent(path)}; path=/; max-age=600; SameSite=Lax${secure}`;
}

export type OAuthStrategy = 'oauth_google' | 'oauth_apple' | 'oauth_facebook';

export interface AuthenticateWithRedirectParams {
  strategy: OAuthStrategy | string;
  /** Callback path on this site. Default '/sso-callback'. */
  redirectUrl?: string;
  /** Where to land after the callback. Default '/'. */
  redirectUrlComplete?: string;
}

export interface OtpAttemptResult {
  status: 'complete' | 'needs_second_factor' | 'missing_requirements';
  createdSessionId: string | undefined;
}

/**
 * The Clerk-shaped sign-in/sign-up object the login modal drives. Kept
 * identical to the CRA version so the modal ports unchanged.
 */
export interface OtpFlow {
  authenticateWithRedirect: (params: AuthenticateWithRedirectParams) => Promise<void>;
  create: (params: { identifier?: string; emailAddress?: string }) => Promise<{
    supportedFirstFactors: Array<{ strategy: 'email_code'; emailAddressId: string }>;
    emailAddress: string;
  }>;
  prepareFirstFactor: (params: { strategy: string; emailAddressId?: string }) => Promise<{ status: 'needs_first_factor' }>;
  attemptFirstFactor: (params: { strategy: string; code: string }) => Promise<OtpAttemptResult>;
  prepareEmailAddressVerification: (params: { strategy: string }) => Promise<{ status: 'missing_requirements' }>;
  attemptEmailAddressVerification: (params: { code: string }) => Promise<OtpAttemptResult>;
  update: (params?: Record<string, unknown>) => Promise<{ status: 'complete' }>;
}

const OAUTH_PROVIDERS: Record<OAuthStrategy, 'google' | 'apple' | 'facebook'> = {
  oauth_google: 'google',
  oauth_apple: 'apple',
  oauth_facebook: 'facebook',
};

function isOAuthStrategy(value: string): value is OAuthStrategy {
  return value in OAUTH_PROVIDERS;
}

function createOtpFlow(): OtpFlow {
  return {
    authenticateWithRedirect: async ({ strategy, redirectUrl = '/sso-callback', redirectUrlComplete = '/' }) => {
      if (!isOAuthStrategy(strategy)) {
        throw new Error(`Unsupported OAuth strategy: ${strategy}`);
      }
      const provider = OAUTH_PROVIDERS[strategy];

      // PKCE: the code verifier is written to a cookie by the browser client,
      // and the /sso-callback route handler exchanges the returned ?code= for
      // a session server-side. The landing path rides in AUTH_NEXT_COOKIE.
      rememberNext(redirectUrlComplete);
      const redirectTo = `${window.location.origin}${redirectUrl}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) throw error;
    },
    create: async ({ identifier, emailAddress }) => {
      const email = identifier || emailAddress;
      if (!email) throw new Error('Email is required');
      pendingOtpEmail = email;
      return {
        supportedFirstFactors: [{ strategy: 'email_code', emailAddressId: email }],
        emailAddress: email,
      };
    },
    prepareFirstFactor: async ({ strategy }) => {
      if (strategy !== 'email_code') throw new Error('Unsupported factor strategy');
      if (!pendingOtpEmail) throw new Error('No pending email authentication request');

      const { error } = await supabase.auth.signInWithOtp({
        email: pendingOtpEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/sso-callback`,
        },
      });
      if (error) throw error;
      return { status: 'needs_first_factor' };
    },
    attemptFirstFactor: async ({ strategy, code }) => {
      if (strategy !== 'email_code') throw new Error('Unsupported factor strategy');
      if (!pendingOtpEmail) throw new Error('No pending email authentication request');

      const { data, error } = await supabase.auth.verifyOtp({
        email: pendingOtpEmail,
        token: code,
        type: 'email',
      });
      if (error) throw error;

      return {
        status: data.session ? 'complete' : 'needs_second_factor',
        createdSessionId: data.session?.access_token,
      };
    },
    prepareEmailAddressVerification: async ({ strategy }) => {
      if (strategy !== 'email_code') throw new Error('Unsupported verification strategy');
      if (!pendingOtpEmail) throw new Error('No pending email verification request');

      const { error } = await supabase.auth.signInWithOtp({
        email: pendingOtpEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/sso-callback`,
        },
      });
      if (error) throw error;
      return { status: 'missing_requirements' };
    },
    attemptEmailAddressVerification: async ({ code }) => {
      if (!pendingOtpEmail) throw new Error('No pending email verification request');

      const { data, error } = await supabase.auth.verifyOtp({
        email: pendingOtpEmail,
        token: code,
        type: 'email',
      });
      if (error) throw error;

      return {
        status: data.session ? 'complete' : 'missing_requirements',
        createdSessionId: data.session?.access_token,
      };
    },
    update: async () => ({ status: 'complete' }),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    try {
      // Client-side getSession is fine: it is the browser reading its own
      // cookie. The server-side rule (never getSession) is about trusting it.
      supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (error) {
            console.error('Failed to load Supabase session:', error);
          }
          if (!mounted) return;
          setSession(data.session || null);
          const restored = mapUser(data.session?.user || null);
          setUser(restored);
          // Bind replays and funnels to the account, not just the anonymous device.
          identifyUser(restored);
          setIsLoaded(true);
        })
        .catch((error: unknown) => {
          console.error('Failed to load Supabase session:', error);
          if (mounted) setIsLoaded(true);
        });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession || null);
        const nextUser = mapUser(nextSession?.user || null);
        setUser(nextUser);
        if (nextUser) identifyUser(nextUser);
        setIsLoaded(true);
        // GA4 sign_up, emitted once per account. Supabase reports SIGNED_IN for
        // every session restore, so the account's own created_at is what
        // distinguishes a real registration from a returning login. Never-throw.
        maybeTrackSignUp(nextSession);
      });
      unsubscribe = () => subscription.unsubscribe();
    } catch (error) {
      // Missing env: render signed out rather than crash the page.
      console.error(error);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoaded(true);
    }

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ session, user, isLoaded, isSignedIn: !!session }),
    [session, user, isLoaded]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Emit `sign_up` once for a genuinely new account.
 *
 * `onAuthStateChange` fires SIGNED_IN on every page load with a live session,
 * so the event is gated on two things: the account was created moments ago,
 * and this browser has not already reported it.
 */
const SIGNUP_REPORTED_KEY = 'gs_signup_reported';
const NEW_ACCOUNT_WINDOW_MS = 5 * 60 * 1000;

function maybeTrackSignUp(nextSession: Session | null): void {
  try {
    const account = nextSession?.user;
    if (!account?.id || !account.created_at) return;

    const ageMs = Date.now() - new Date(account.created_at).getTime();
    if (!(ageMs >= 0 && ageMs < NEW_ACCOUNT_WINDOW_MS)) return;

    let reported: string | null = null;
    try {
      reported = window.localStorage.getItem(SIGNUP_REPORTED_KEY);
    } catch {
      /* storage unavailable: fall through and report once per page load */
    }
    if (reported === account.id) return;
    try {
      window.localStorage.setItem(SIGNUP_REPORTED_KEY, account.id);
    } catch {
      /* ignore */
    }

    const provider = account.app_metadata?.provider;
    trackSignUp(typeof provider === 'string' ? provider : 'email');
  } catch {
    /* analytics must never affect authentication */
  }
}

function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('Auth hooks must be used within AuthProvider');
  }
  return ctx;
}

export function useUser(): { user: AppUser | null; isLoaded: boolean; isSignedIn: boolean } {
  const { user, isLoaded, isSignedIn } = useAuthContext();
  return { user, isLoaded, isSignedIn };
}

// Stable across renders so it can be used safely in useEffect dependency
// arrays without retriggering the effect on every render.
const getToken = async (): Promise<string | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token || null;
};

const signOut = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  // Stop attributing the next session to the user who just left.
  resetObservability();
};

const setActive = async (_params?: Record<string, unknown>): Promise<void> => undefined;

export function useAuth(): {
  isLoaded: boolean;
  isSignedIn: boolean;
  sessionId: string | null;
  getToken: () => Promise<string | null>;
} {
  const { session, isLoaded, isSignedIn } = useAuthContext();
  return {
    isLoaded,
    isSignedIn,
    sessionId: session?.access_token || null,
    getToken,
  };
}

export function useSignIn(): { signIn: OtpFlow } {
  return { signIn: createOtpFlow() };
}

export function useSignUp(): { signUp: OtpFlow } {
  return { signUp: createOtpFlow() };
}

// Auth side-effect actions (sign out, etc.). Returns module-level stable
// references so consumers can list them in effect deps without loops.
export function useAuthActions(): {
  signOut: () => Promise<void>;
  setActive: (params?: Record<string, unknown>) => Promise<void>;
} {
  return { signOut, setActive };
}

export function SignedIn({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuthContext();
  return isSignedIn ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuthContext();
  return isSignedIn ? null : <>{children}</>;
}
