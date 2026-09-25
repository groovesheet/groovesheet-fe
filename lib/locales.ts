/**
 * Locale constants shared by server and client code. Server-safe: no hooks.
 */
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/routing';

export { SUPPORTED_LOCALES, DEFAULT_LOCALE, isLocale, type Locale };

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  'zh-CN': '中文 (简体)',
  'zh-TW': '中文 (繁體)',
};

export const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  en: 'EN',
  'zh-CN': '简',
  'zh-TW': '繁',
};

/** BCP 47 tags for <html lang> and hreflang. */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  en: 'en',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
};

// Set once the visitor picks a language for themselves. Vercel's edge
// redirects in vercel.json only fire when this cookie is absent, so an
// explicit choice permanently overrides the country-based guess, including a
// visitor in China deliberately choosing English. proxy.ts also reads it to
// send a returning visitor from `/` to their chosen locale's home page.
export const LOCALE_COOKIE = 'gs_locale';
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function rememberLocaleChoice(locale: string): void {
  if (typeof document === 'undefined') return;
  if (!isLocale(locale)) return;
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  document.cookie = [
    `${LOCALE_COOKIE}=${encodeURIComponent(locale)}`,
    'path=/',
    `max-age=${LOCALE_COOKIE_MAX_AGE}`,
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

function isPrefixedLocale(locale: string | null | undefined): locale is Locale {
  return !!locale && locale !== DEFAULT_LOCALE && (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

/**
 * Prefix `path` for `locale`: the bare path for English, `/zh-CN/...` otherwise.
 * Same contract as the CRA helper, for code that builds URLs by hand (a
 * `window.location.assign`, a share link). Prefer <Link> and useRouter.
 */
export function buildLocalePath(locale: string, path: string | { pathname?: string }): string {
  const target = typeof path === 'string' ? path : path?.pathname || '/';
  if (!isPrefixedLocale(locale)) return target;
  if (target.startsWith(`/${locale}/`) || target === `/${locale}`) return target;
  const trimmed = target.startsWith('/') ? target : `/${target}`;
  return trimmed === '/' ? `/${locale}` : `/${locale}${trimmed}`;
}

/** `/zh-CN/pricing` -> `/pricing`. Paths without a locale prefix come back unchanged. */
export function stripLocaleFromPath(pathname: string): string {
  for (const locale of SUPPORTED_LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    if (pathname === `/${locale}`) return '/';
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(`/${locale}`.length);
  }
  return pathname;
}
