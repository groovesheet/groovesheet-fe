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

/** Test seam. */
export function _resetAttribution() {
  try {
    window.localStorage.removeItem(FIRST_TOUCH_KEY);
    window.localStorage.removeItem(LAST_TOUCH_KEY);
  } catch (e) {
    /* ignore */
  }
}
