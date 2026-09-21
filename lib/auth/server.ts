/**
 * Server-side auth: Server Components, route handlers, server actions.
 *
 * getClaims() verifies the access token's signature. getSession() is never
 * used on the server: it reads the cookie without verifying it, and anyone can
 * forge a cookie (brief 5.3).
 *
 * Reading cookies makes a route dynamic. Never call these from a Tier A or
 * Tier B page (marketing, /explore, /u): those are cached and served to every
 * visitor, so they must not vary by user (brief 5.9).
 */
import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { JwtPayload, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, assertSupabaseEnv, hasSupabaseAuthCookie } from '@/lib/auth/config';

export type AuthClaims = JwtPayload;

/**
 * A Supabase client bound to this request's cookies. In a Server Component
 * the cookie store is read-only, so a token refresh cannot be written back
 * there; proxy.ts refreshes the session before the page renders, which is
 * why that failure is safe to ignore.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  assertSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: proxy.ts owns the refresh.
        }
      },
    },
  });
}

/**
 * The verified claims of the signed-in user, or null when signed out or the
 * token does not verify. `claims.sub` is the user id.
 */
export async function getClaims(): Promise<AuthClaims | null> {
  const cookieStore = await cookies();
  if (!hasSupabaseAuthCookie(cookieStore.getAll().map((c) => c.name))) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  return data.claims;
}
