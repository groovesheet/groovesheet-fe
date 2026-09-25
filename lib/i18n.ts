/**
 * react-i18next compatibility layer over next-intl, for Client Components.
 *
 * Ported components keep `const { t, i18n } = useTranslation()` and the same
 * keys. Differences from i18next worth knowing:
 *  - interpolation in messages/*.json is ICU `{name}`, not `{{name}}`; the call
 *    site is unchanged: `t('footer.copyright', { year })`
 *  - `t([primary, fallback])` and `{ defaultValue }` work as before
 *  - `i18n.changeLanguage(locale)` navigates to the same page in that locale
 *    and records the explicit choice in the gs_locale cookie
 *
 * Server Components use getT() from lib/i18n-server instead.
 */
'use client';

import { useCallback, useMemo } from 'react';
import { useLocale as useIntlLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/lib/navigation';
import { isLocale, rememberLocaleChoice, type Locale, DEFAULT_LOCALE } from '@/lib/locales';
import { makeCompatT, type CompatT } from '@/lib/i18n-compat';

export {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  LOCALE_SHORT_LABELS,
  LOCALE_COOKIE,
  rememberLocaleChoice,
  isLocale,
  type Locale,
} from '@/lib/locales';
export type { CompatT, CompatTOptions } from '@/lib/i18n-compat';

/** The current locale: 'en' | 'zh-CN' | 'zh-TW'. Replaces the CRA useLocale(). */
export function useLocale(): Locale {
  const locale = useIntlLocale();
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

export interface CompatI18n {
  language: Locale;
  changeLanguage: (locale: string) => void;
}

export function useTranslation(): { t: CompatT; i18n: CompatI18n } {
  const intlT = useTranslations();
  const language = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const t = useMemo(() => makeCompatT(intlT), [intlT]);

  const changeLanguage = useCallback(
    (next: string) => {
      if (!isLocale(next) || next === language) return;
      rememberLocaleChoice(next);
      // Read the query string at call time rather than through useSearchParams,
      // which would force every page using this hook behind a Suspense boundary.
      const search = typeof window !== 'undefined' ? window.location.search : '';
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      router.replace(`${pathname}${search}${hash}`, { locale: next });
    },
    [language, pathname, router]
  );

  const i18n = useMemo(() => ({ language, changeLanguage }), [language, changeLanguage]);
  return { t, i18n };
}
