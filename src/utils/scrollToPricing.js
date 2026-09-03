// Where "you're out of minutes" (402) sends people: the plans, not an error
// banner. Scrolls the in-page pricing section into view when it's mounted,
// otherwise navigates to the pricing page, preserving any locale prefix.

export const PRICING_SECTION_ID = 'pricing';

/** Fired at the mounted <Pricing /> so it can preselect a tab. */
export const PRICING_TAB_EVENT = 'gs:pricing-tab';

/**
 * Send someone to pricing, optionally landing them on a specific tab.
 *
 * Out of minutes is the moment of highest purchase intent, and the cheapest
 * thing that fixes it is a top-up, not a subscription. Dropping people on the
 * plans tab asks them for $10/month when $4 unblocks the song they are already
 * trying to transcribe, so callers can name the tab they want.
 *
 * @param {{tab?: 'plans'|'topups'}} [options]
 */
export function scrollToPricing(options = {}) {
  const tab = options.tab === 'topups' ? 'topups' : null;
  const el = document.getElementById(PRICING_SECTION_ID);
  if (el) {
    if (tab) {
      try {
        window.dispatchEvent(new CustomEvent(PRICING_TAB_EVENT, { detail: tab }));
      } catch (e) {
        /* preselecting a tab is best-effort; the scroll still happens */
      }
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const localeMatch = window.location.pathname.match(/^\/(zh-CN|zh-TW)(?=\/|$)/);
  const prefix = localeMatch ? localeMatch[0] : '';
  window.location.assign(`${prefix}/pricing${tab ? `?tab=${tab}` : ''}`);
}

export default scrollToPricing;
