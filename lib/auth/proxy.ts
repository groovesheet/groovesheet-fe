/**
 * Session refresh for proxy.ts. Kept apart from lib/auth/server.ts because
 * proxy code works on the NextRequest/NextResponse pair rather than on
 * next/headers.
 */
import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import type { JwtPayload } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, hasSupabaseAuthCookie } from '@/lib/auth/config';

export interface SessionResult {
  /** Verified claims, or null when signed out or the token did not verify. */
  claims: JwtPayload | null;
  /** Cookies Supabase asked to write (a refreshed token), to copy onto any redirect. */
  cookiesToSet: Array<{ name: string; value: string; options: Parameters<NextResponse['cookies']['set']>[2] }>;
}

/**
 * Verify, and if needed refresh, the Supabase session carried by `request`,
 * writing any refreshed cookies onto `response`.
 *
 * Skips Supabase entirely when the request has no auth cookie, which is every
 * anonymous visitor and every crawler: no network call, no Set-Cookie, so
 * public pages stay cacheable.
 */
export async function refreshSession(request: NextRequest, response: NextResponse): Promise<SessionResult> {
  const result: SessionResult = { claims: null, cookiesToSet: [] };
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return result;
  if (!hasSupabaseAuthCookie(request.cookies.getAll().map((c) => c.name))) return result;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
          result.cookiesToSet.push({ name, value, options });
        }
      },
    },
  });

  // getClaims verifies the JWT signature (and refreshes an expired session
  // through setAll above). Never getSession() here: it trusts the cookie.
  const { data, error } = await supabase.auth.getClaims();
  result.claims = error || !data ? null : data.claims;
  return result;
}
