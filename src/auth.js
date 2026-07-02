import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables: REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const AuthContext = createContext(null);
let pendingOtpEmail = null;

function mapUser(user) {
  if (!user) return null;

  const identityProviders = Array.isArray(user.identities)
    ? user.identities.map((identity) => identity.provider)
    : [];

  return {
    id: user.id,
    user_id: user.id,
    email: user.email,
    first_name:
      user.user_metadata?.first_name ||
      user.user_metadata?.given_name ||
      user.user_metadata?.name?.split(' ')?.[0] ||
      null,
    last_name: user.user_metadata?.last_name || user.user_metadata?.family_name || null,
    name: user.user_metadata?.name || user.email || null,
    image_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
    picture: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
    app_metadata: user.app_metadata || {},
    user_metadata: user.user_metadata || {},
    external_accounts: identityProviders
      .filter((provider) => provider && provider !== 'email')
      .map((provider) => ({ provider })),
    identities: user.identities || [],
  };
}

function createOtpFlow() {
  return {
    authenticateWithRedirect: async ({ strategy, redirectUrl = '/sso-callback', redirectUrlComplete = '/' }) => {
      const providerMap = {
        oauth_google: 'google',
        oauth_apple: 'apple',
        oauth_facebook: 'facebook',
      };
      const provider = providerMap[strategy];
      if (!provider) {
        throw new Error(`Unsupported OAuth strategy: ${strategy}`);
      }

      const redirectTo = `${window.location.origin}${redirectUrl}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          queryParams: redirectUrlComplete ? { next: redirectUrlComplete } : undefined,
        },
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

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Failed to load Supabase session:', error);
      }
      if (!mounted) return;
      setSession(data.session || null);
      setUser(mapUser(data.session?.user || null));
      setIsLoaded(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      setUser(mapUser(nextSession?.user || null));
      setIsLoaded(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ session, user, isLoaded, isSignedIn: !!session }),
    [session, user, isLoaded]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('Auth hooks must be used within AuthProvider');
  }
  return ctx;
}

export function useUser() {
  const { user, isLoaded, isSignedIn } = useAuthContext();
  return { user, isLoaded, isSignedIn };
}

// Stable across renders so it can be used safely in useEffect dependency
// arrays without retriggering the effect on every render.
const getToken = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token || null;
};

const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

const setActive = async () => undefined;

export function useAuth() {
  const { session, isLoaded, isSignedIn } = useAuthContext();
  return {
    isLoaded,
    isSignedIn,
    sessionId: session?.access_token || null,
    getToken,
  };
}

export function useSignIn() {
  return { signIn: createOtpFlow() };
}

export function useSignUp() {
  return { signUp: createOtpFlow() };
}

// Auth side-effect actions (sign out, etc.). Returns module-level stable
// references so consumers can list them in effect deps without loops.
export function useAuthActions() {
  return { signOut, setActive };
}

export function SignedIn({ children }) {
  const { isSignedIn } = useAuthContext();
  return isSignedIn ? <>{children}</> : null;
}

export function SignedOut({ children }) {
  const { isSignedIn } = useAuthContext();
  return isSignedIn ? null : <>{children}</>;
}
