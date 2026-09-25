import { defineRouting } from 'next-intl/routing';

export const SUPPORTED_LOCALES = ['en', 'zh-CN', 'zh-TW'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * English is unprefixed (`/pricing`), the two Chinese locales are prefixed
 * (`/zh-CN/pricing`). This matches the CRA app's buildLocalePath exactly, so no
 * indexed URL changes.
 *
 * Locale detection is off on purpose. The unprefixed path is English for every
 * visitor, crawlers included; the only automatic redirects are Vercel's
 * country-based ones in vercel.json and the explicit-choice cookie handled in
 * proxy.ts. next-intl's own cookie is off too: a Set-Cookie on every public
 * page response would make it look per-user to the CDN.
 */
export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
  localeDetection: false,
  localeCookie: false,
  alternateLinks: false,
});

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
