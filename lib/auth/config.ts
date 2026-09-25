/**
 * Supabase settings shared by the browser client, the server helpers and
 * proxy.ts. Server-safe. Read as literal NEXT_PUBLIC_* members so Next inlines
 * them into the browser bundle at build time.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export function assertSupabaseEnv(): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }
}

/**
 * Where to send the browser after the OAuth or magic-link round trip. Set by
 * the sign-in flow just before it leaves the site and read by the
 * /sso-callback route handler (P6). A cookie rather than a `?next=` on the
 * redirect URL, because Supabase matches redirect URLs against an allow-list
 * and an extra query string can fail that match.
 */
export const AUTH_NEXT_COOKIE = 'gs_auth_next';

/** True when a request carries any Supabase auth cookie (sb-<ref>-auth-token, possibly chunked). */
export function hasSupabaseAuthCookie(names: Iterable<string>): boolean {
  for (const name of names) {
    if (name.startsWith('sb-') && name.includes('-auth-token')) return true;
  }
  return false;
}
