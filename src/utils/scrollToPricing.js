// Where "you're out of minutes" (402) sends people: the plans, not an error
// banner. Scrolls the in-page pricing section into view when it's mounted,
// otherwise navigates to the pricing page, preserving any locale prefix.

export const PRICING_SECTION_ID = 'pricing';

export function scrollToPricing() {
  const el = document.getElementById(PRICING_SECTION_ID);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const localeMatch = window.location.pathname.match(/^\/(zh-CN|zh-TW)(?=\/|$)/);
  const prefix = localeMatch ? localeMatch[0] : '';
  window.location.assign(`${prefix}/pricing`);
}

export default scrollToPricing;
