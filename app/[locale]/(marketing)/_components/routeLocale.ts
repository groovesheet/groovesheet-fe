import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isLocale, type Locale } from '@/lib/locales';

export interface LocaleParams {
  params: Promise<{ locale: string }>;
}

/**
 * Await the locale segment, narrow it, and register it for static rendering.
 * The locale layout already 404s an unknown locale; narrowing here gives the
 * page a typed Locale for getT.
 */
export async function routeLocale({ params }: LocaleParams): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  return locale;
}
