/**
 * Campaign attribution capture for social landings.
 *
 * A visitor arrives from a YouTube or bilibili description on
 * `/explore/{slug}?utm_source=...&utm_medium=social&utm_campaign=...&utm_content=...&gs_v=...`
 * The query string is gone as soon as they navigate, so we snapshot it once on
 * landing and keep it for the rest of the funnel.
 *
 * Two records are kept, matching the MVP contract:
 *
 *   first touch  written once, never overwritten. This is the acquisition
 *                source that survives to signup.
 *   last touch   overwritten by each new campaign landing, so a later
 *                conversion can also be credited to the most recent campaign.
 *
 * A visit with no campaign parameters never overwrites either record: an
 * organic return visit must not erase how the visitor was actually acquired.
 *
 * Everything here is best-effort. Storage can throw (Safari private mode,
 * disabled cookies, quota) and none of it may ever break Explore.
 */

const FIRST_TOUCH_KEY = 'gs_attr_first';
const LAST_TOUCH_KEY = 'gs_attr_last';

/**
 * The Google Ads click that brought this visitor here.
 *
 * Kept separate from the two touch records above because it answers a
 * different question and follows a different rule. Those record *how we
 * acquired* someone and so are first-touch; Google Ads bills and attributes on
 * the *most recent* click, so this is deliberately last-touch and overwritten
 * by each new ad landing.
 *
 * It exists because revenue and ad spend were two unrelated numbers: a payment
 * could not be traced to the click that paid for it, which is the only way to
 * know whether an ad earned back more than it cost. This is carried into
 * Stripe Checkout metadata and recorded on the payment server-side.
 *
 * 90 days is Google's maximum click-through conversion window; a click older
 * than that would no longer be credited by Google either, so keeping it would
 * only overstate our own attribution.
 */
const CLICK_ID_KEY = 'gs_click_id';
const CLICK_ID_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Google's click identifiers, in the order it prefers them. `gclid` is the
 * ordinary web click; `gbraid`/`wbraid` replace it for iOS and app campaigns,
 * where `gclid` is withheld.
 */
const CLICK_ID_PARAMS = ['gclid', 'gbraid', 'wbraid'];

/** utm_source values we treat as a known platform. */
const KNOWN_PLATFORMS = ['youtube', 'bilibili'];

function safeGet(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Normalise utm_source into the `gs_source_platform` vocabulary.
 * Unknown-but-present sources become 'other'; absent becomes 'direct'.
 */
export function sourcePlatform(utmSource, referrer) {
  const source = (utmSource || '').toLowerCase();
  if (KNOWN_PLATFORMS.includes(source)) return source;
  if (source) return 'other';
  if (referrer) return 'organic';
  return 'direct';
}

/**
 * Read campaign parameters out of a query string.
 * Returns null when the landing carries no campaign at all.
 */
export function parseCampaign(search, referrer = '') {
  let params;
  try {
    params = new URLSearchParams(search || '');
  } catch (e) {
    return null;
  }

  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');
  const utmCampaign = params.get('utm_campaign');
  const utmContent = params.get('utm_content');
  const videoId = params.get('gs_v');

  // No campaign markers at all: an organic or direct visit.
  if (!utmSource && !utmMedium && !utmCampaign && !utmContent && !videoId) {
    return null;
  }

  return {
    gs_source_platform: sourcePlatform(utmSource, referrer),
    gs_campaign: utmCampaign || null,
    gs_content: utmContent || null,
    gs_video_id: videoId || null,
    utm_medium: utmMedium || null,
  };
}

/**
 * Capture the current landing.
 *
 * Writes last touch on every campaign landing and first touch only when it is
 * absent. Returns the first-touch record (or null when nothing was ever
 * captured), because that is what downstream events are attributed to.
 */
export function captureAttribution(search, referrer = '') {
  const campaign = parseCampaign(search, referrer);
  if (!campaign) {
    // An organic visit must not overwrite a real acquisition source.
    return safeGet(FIRST_TOUCH_KEY);
  }

  const record = { ...campaign, seen_at: new Date().toISOString() };
  safeSet(LAST_TOUCH_KEY, record);

  const existing = safeGet(FIRST_TOUCH_KEY);
  if (!existing) {
    safeSet(FIRST_TOUCH_KEY, record);
    return record;
  }
  // First touch is written once and never rewritten.
  return existing;
}

export function getFirstTouch() {
  return safeGet(FIRST_TOUCH_KEY);
}

export function getLastTouch() {
  return safeGet(LAST_TOUCH_KEY);
}

/**
 * Campaign properties to attach to an outgoing analytics event.
 * Prefers first touch, falls back to last touch, and is always a plain object.
 */
export function attributionProps() {
  const touch = getFirstTouch() || getLastTouch();
  if (!touch) return { gs_source_platform: 'direct' };
  return {
    gs_source_platform: touch.gs_source_platform || 'direct',
    gs_campaign: touch.gs_campaign || undefined,
    gs_content: touch.gs_content || undefined,
    gs_video_id: touch.gs_video_id || undefined,
    gs_attribution_age: getFirstTouch() ? 'first_touch' : 'last_touch',
  };
}

/**
 * Snapshot the ad click on landing, if this landing carries one.
 *
 * The query string is gone as soon as the visitor navigates, and payment
 * happens many pages later, so the click id has to be stored the moment it
 * arrives. A visit with no click id leaves any stored one alone — an organic
 * return visit must not erase the ad that is still inside its window.
 */
export function captureClickId(search) {
  let params;
  try {
    params = new URLSearchParams(search || '');
  } catch (e) {
    return getClickIds();
  }

  const found = {};
  CLICK_ID_PARAMS.forEach((name) => {
    const value = params.get(name);
    // Stripe metadata caps values at 500 characters; a longer one is not a
    // real click id and must not travel far enough to break Checkout.
    if (value && value.length <= 500) found[name] = value;
  });

  if (!Object.keys(found).length) return getClickIds();

  safeSet(CLICK_ID_KEY, { ...found, seen_at: new Date().toISOString() });
  return found;
}

/**
 * The stored click identifiers, or an empty object when there is no live one.
 * Always a plain object, so call sites can spread it unconditionally.
 */
export function getClickIds() {
  const record = safeGet(CLICK_ID_KEY);
  if (!record) return {};

  const seenAt = Date.parse(record.seen_at || '');
  if (Number.isNaN(seenAt) || Date.now() - seenAt > CLICK_ID_MAX_AGE_MS) return {};

  const out = {};
  CLICK_ID_PARAMS.forEach((name) => {
    if (record[name]) out[name] = record[name];
  });
  return out;
}

/** Test seam. */
export function _resetAttribution() {
  try {
    window.localStorage.removeItem(FIRST_TOUCH_KEY);
    window.localStorage.removeItem(LAST_TOUCH_KEY);
    window.localStorage.removeItem(CLICK_ID_KEY);
  } catch (e) {
    /* ignore */
  }
}
