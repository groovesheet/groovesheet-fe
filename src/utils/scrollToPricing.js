import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../i18n';

/**
 * Scroll the pricing section into view.
 *
 * Used when an action needs minutes the user doesn't have (e.g. promoting a
 * 10-second preview to a full run returns 402). "Insufficient minutes" is a
 * dead end; the plans are what the user actually needs, so we take them there
 * instead of surfacing an error.
 *
 * Every page that offers the upgrade CTA (Hero/landing, MidiConverter,
 * StemSplitter) renders <Pricing />, so the target is on the same page. The
 * navigation fallback only matters if that ever stops being true — it reads
 * the locale off the URL so a /zh-CN visitor keeps their prefix.
 */
export const PRICING_SECTION_ID = 'pricing';

function localePrefixFromPath(pathname) {
  for (const locale of SUPPORTED_LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) return `/${locale}`;
  }
  return '';
}

export function scrollToPricing() {
  const section = document.getElementById(PRICING_SECTION_ID);
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }
  window.location.assign(`${localePrefixFromPath(window.location.pathname)}/pricing`);
  return false;
}
