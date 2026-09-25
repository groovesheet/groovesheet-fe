/**
 * The OAuth and email-link landing: GET /sso-callback (and /zh-CN/sso-callback,
 * /zh-TW/sso-callback, which is where Vercel's country redirects send some
 * visitors on the way back).
 *
 * Replaces src/components/SSOCallback.js. The code is exchanged here, on the
 * server, so the session cookie is set on the redirect response and the very
 * next request (proxy.ts, the /account gate) already sees the user. The CRA
 * page also accepted `#access_token=` (the implicit flow); a fragment never
 * reaches the server, and the browser client is PKCE-only now, so that path
 * is gone (brief 5.11).
 *
 *   ?code=...                  OAuth (Google, Facebook, Apple) and PKCE magic links
 *   ?token_hash=...&type=...   email links built from a custom template
 *   ?error=...                 provider refusal or cancel
 *
 * The landing path comes from the gs_auth_next cookie that
 * authenticateWithRedirect wrote before leaving the site. A route handler has
 * no metadata to generate; it never renders.
 */
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/auth/server';
import { AUTH_NEXT_COOKIE } from '@/lib/auth/config';
import { DEFAULT_LOCALE, buildLocalePath, isLocale } from '@/lib/locales';

export const dynamic = 'force-dynamic';

interface Context {
  params: Promise<{ locale: string }>;
}

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (EMAIL_OTP_TYPES as readonly string[]).includes(value);
}

/**
 * The cookie is ours, but anyone can set a cookie on their own request, so it
 * is treated as untrusted: only a same-origin absolute path survives. A
 * backslash is rejected because browsers read `/\evil.com` as `//evil.com`.
 */
function safeNextPath(raw: string | undefined, origin: string): string | null {
  if (!raw) return null;
  let value: string;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function noStoreRedirect(url: URL): NextResponse {
  const response = NextResponse.redirect(url);
  // A redirect that carries a fresh session cookie must never be cached.
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function GET(request: NextRequest, { params }: Context): Promise<NextResponse> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const origin = request.nextUrl.origin;
  const search = request.nextUrl.searchParams;

  const cookieStore = await cookies();
  const next = safeNextPath(cookieStore.get(AUTH_NEXT_COOKIE)?.value, origin);
  // One use only: a stale value must not hijack a later sign-in.
  cookieStore.delete(AUTH_NEXT_COOKIE);

  const home = buildLocalePath(locale, '/');

  // Back to the modal, keeping the destination so a retry still lands there.
  const retry = (): NextResponse => {
    const url = new URL(home, origin);
    url.searchParams.set('signin', '1');
    if (next) url.searchParams.set('next', next);
    return noStoreRedirect(url);
  };

  if (search.get('error')) {
    console.error('SSO callback returned an error:', search.get('error_description') || search.get('error'));
    return retry();
  }

  const code = search.get('code');
  const tokenHash = search.get('token_hash');
  const type = search.get('type');
  // Only present if auth-js's appendPkceFlowIdToRedirects is on; it picks the
  // right verifier when two sign-ins were started in the same browser.
  const flowId = search.get('sb_flow_id');

  const emailLink = tokenHash && isEmailOtpType(type) ? { token_hash: tokenHash, type } : null;

  if (!code && !emailLink) {
    // Nothing to exchange (a bookmarked or replayed callback URL).
    return noStoreRedirect(new URL(next || home, origin));
  }

  try {
    const supabase = await createSupabaseServerClient();
    // setAll in createSupabaseServerClient writes through cookies(), which a
    // route handler applies to the response it returns, redirect included.
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined)
      : emailLink
        ? await supabase.auth.verifyOtp(emailLink)
        : { error: null };
    if (error) throw error;
  } catch (error) {
    // Typically a missing code verifier: the flow was started in another
    // browser (a magic link opened on a second device) or the cookie expired.
    console.error('Error completing SSO callback:', error);
    return retry();
  }

  return noStoreRedirect(new URL(next || home, origin));
}
