/**
 * Runs before every page request (Next 16's name for middleware.ts).
 *
 *  1. Locale routing (next-intl): English is unprefixed, /zh-CN and /zh-TW
 *     are prefixed. `/` also honours an explicit language choice stored in
 *     the gs_locale cookie, which is what LocaleSync did in the CRA app.
 *  2. Supabase session refresh, only when the request carries an auth cookie,
 *     so anonymous traffic (and every crawler) never touches Supabase.
 *  3. The /account/* gate: signed-out visitors are redirected before the page
 *     renders, using getClaims(), which verifies the token signature.
 *     Never getSession() here (brief 5.3).
 *
 * The matcher keeps it off /api, the content-app paths (/blog, /blog-media,
 * /internal, /content-assets), Next's own assets and any path with a file
 * extension.
 */
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { refreshSession } from '@/lib/auth/proxy';
import { LOCALE_COOKIE } from '@/lib/locales';

const handleI18nRouting = createIntlMiddleware(routing);

const PREFIXED_LOCALES = ['zh-CN', 'zh-TW'] as const;

/** /account, /account/..., with or without a locale prefix. */
const ACCOUNT_PATH = /^(?:\/(zh-CN|zh-TW))?\/account(?:\/|$)/;

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  // A returning visitor who explicitly chose Chinese lands on their locale's
  // home page. Only `/`: deep links are never second-guessed.
  if (pathname === '/') {
    const chosen = request.cookies.get(LOCALE_COOKIE)?.value;
    const prefixed = PREFIXED_LOCALES.find((l) => l === chosen);
    if (prefixed) {
      const url = request.nextUrl.clone();
      url.pathname = `/${prefixed}`;
      return NextResponse.redirect(url);
    }
  }

  const response = handleI18nRouting(request);
  const session = await refreshSession(request, response);

  const account = pathname.match(ACCOUNT_PATH);
  if (account && !session.claims) {
    const prefix = account[1] ? `/${account[1]}` : '';
    const url = request.nextUrl.clone();
    url.pathname = prefix || '/';
    url.search = '';
    // The page the visitor wanted, so the sign-in flow can return them there.
    url.searchParams.set('signin', '1');
    url.searchParams.set('next', `${pathname}${search}`);
    const redirect = NextResponse.redirect(url);
    // Keep whatever Supabase wrote (a cleared or refreshed cookie).
    for (const { name, value, options } of session.cookiesToSet) redirect.cookies.set(name, value, options);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!(?:api|blog|blog-media|internal|content-assets|_next|_vercel)(?:/|$)|.*\\..*).*)',
  ],
};
