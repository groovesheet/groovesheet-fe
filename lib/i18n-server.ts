/**
 * Server Component counterpart of lib/i18n's useTranslation: same `t` shape,
 * same keys.
 *
 *   const t = await getT(locale);
 *   return <h1>{t('about.title')}</h1>;
 *
 * Call setRequestLocale(locale) (from next-intl/server) at the top of every
 * page and layout first, or the route opts out of static rendering.
 */
import 'server-only';
import { getTranslations } from 'next-intl/server';
import { makeCompatT, type CompatT } from '@/lib/i18n-compat';
import type { Locale } from '@/lib/locales';

export async function getT(locale: Locale): Promise<CompatT> {
  const intlT = await getTranslations({ locale });
  return makeCompatT(intlT);
}
