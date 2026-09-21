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
 * Ad click identifiers, the only reliable marker of a paid click.
 *
 * `gclid` is the ordinary Google web click; `gbraid`/`wbraid` replace it for
 * iOS and app campaigns, where `gclid` is withheld. `fbclid`, `ttclid` and
 * `msclkid` are the Meta, TikTok and Bing equivalents.
 *
 * Why the non-Google ones matter: Google Ads and Meta each attribute a
 * conversion using their own click id and their own lookback window, so both
 * will claim the same signup and the two dashboards will sum to more signups
 * than happened. Neither can see the other's clicks, so no report inside
 * either one can settle it. Keeping every network's click id on our own record
 * is what makes "which channel produced this" answerable.
 */
const CLICK_ID_PARAMS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid', 'msclkid'] as const;
export type ClickIdParam = (typeof CLICK_ID_PARAMS)[number];
export type ClickIdRecord = Partial<Record<ClickIdParam, string>>;

/** Which network a click id belongs to, for gs_source_platform. */
const CLICK_ID_PLATFORM: Record<ClickIdParam, string> = {
  gclid: 'google_ads',
  gbraid: 'google_ads',
  wbraid: 'google_ads',
  fbclid: 'meta_ads',
  ttclid: 'tiktok_ads',
  msclkid: 'bing_ads',
};

/** utm_source values we treat as a known platform. */
const KNOWN_PLATFORMS = ['youtube', 'bilibili'];

export interface CampaignTouch extends ClickIdRecord {
  gs_source_platform: string;
  gs_campaign: string | null;
  gs_content: string | null;
  gs_video_id: string | null;
  utm_medium: string | null;
  seen_at?: string;
}

export interface AttributionProps extends ClickIdRecord {
  gs_source_platform: string;
  gs_campaign?: string;
  gs_content?: string;
  gs_video_id?: string;
  gs_attribution_age?: 'first_touch' | 'last_touch';
}

function safeGet<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalise utm_source into the `gs_source_platform` vocabulary.
 * Unknown-but-present sources become 'other'; absent becomes 'direct'.
 */
export function sourcePlatform(utmSource: string | null | undefined, referrer?: string | null): string {
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
export function parseCampaign(search: string | null | undefined, referrer: string = ''): CampaignTouch | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search || '');
  } catch {
    return null;
  }

  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');
  const utmCampaign = params.get('utm_campaign');
  const utmContent = params.get('utm_content');
  const videoId = params.get('gs_v');
  const clickIds: ClickIdRecord = {};
  CLICK_ID_PARAMS.forEach((name) => {
    const value = params.get(name);
    if (value && value.length <= 500) clickIds[name] = value;
  });
  const firstClickId = CLICK_ID_PARAMS.find((name) => clickIds[name]);
  const paidPlatform = firstClickId ? CLICK_ID_PLATFORM[firstClickId] : null;

  // No campaign markers at all: an organic or direct visit.
  if (!utmSource && !utmMedium && !utmCampaign && !utmContent && !videoId && !paidPlatform) {
    return null;
  }

  return {
    // A click ID outranks utm_source when deciding the platform. The ad
    // networks append it themselves on every paid click, whereas UTMs are
    // hand-written and routinely missing or wrong.
    gs_source_platform: paidPlatform || sourcePlatform(utmSource, referrer),
    gs_campaign: utmCampaign || null,
    gs_content: utmContent || null,
    gs_video_id: videoId || null,
    utm_medium: utmMedium || null,
    ...clickIds,
  };
}

/**
 * Capture the current landing.
 *
 * Writes last touch on every campaign landing and first touch only when it is
 * absent. Returns the first-touch record (or null when nothing was ever
 * captured), because that is what downstream events are attributed to.
 */
export function captureAttribution(search: string | null | undefined, referrer: string = ''): CampaignTouch | null {
  const campaign = parseCampaign(search, referrer);
  if (!campaign) {
    // An organic visit must not overwrite a real acquisition source.
    return safeGet<CampaignTouch>(FIRST_TOUCH_KEY);
  }

  const record: CampaignTouch = { ...campaign, seen_at: new Date().toISOString() };
  safeSet(LAST_TOUCH_KEY, record);

  const existing = safeGet<CampaignTouch>(FIRST_TOUCH_KEY);
  if (!existing) {
    safeSet(FIRST_TOUCH_KEY, record);
    return record;
  }
  // First touch is written once and never rewritten.
  return existing;
}

export function getFirstTouch(): CampaignTouch | null {
  return safeGet<CampaignTouch>(FIRST_TOUCH_KEY);
}

export function getLastTouch(): CampaignTouch | null {
  return safeGet<CampaignTouch>(LAST_TOUCH_KEY);
}

/**
 * Campaign properties to attach to an outgoing analytics event.
 * Prefers first touch, falls back to last touch, and is always a plain object.
 */
export function attributionProps(): AttributionProps {
  const touch = getFirstTouch() || getLastTouch();
  if (!touch) return { gs_source_platform: 'direct' };
  const props: AttributionProps = {
    gs_source_platform: touch.gs_source_platform || 'direct',
    gs_campaign: touch.gs_campaign || undefined,
    gs_content: touch.gs_content || undefined,
    gs_video_id: touch.gs_video_id || undefined,
    gs_attribution_age: getFirstTouch() ? 'first_touch' : 'last_touch',
  };
  // Carry the click ID through to the conversion event so the signup can be
  // tied back to one specific ad click rather than to a channel guess.
  CLICK_ID_PARAMS.forEach((name) => {
    if (touch[name]) props[name] = touch[name];
  });
  return props;
}

/**
 * Snapshot the ad click on landing, if this landing carries one.
 *
 * The query string is gone as soon as the visitor navigates, and payment
 * happens many pages later, so the click id has to be stored the moment it
 * arrives. A visit with no click id leaves any stored one alone: an organic
 * return visit must not erase the ad that is still inside its window.
 */
export function captureClickId(search: string | null | undefined): ClickIdRecord {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search || '');
  } catch {
    return getClickIds();
  }

  const found: ClickIdRecord = {};
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
export function getClickIds(): ClickIdRecord {
  const record = safeGet<ClickIdRecord & { seen_at?: string }>(CLICK_ID_KEY);
  if (!record) return {};

  const seenAt = Date.parse(record.seen_at || '');
  if (Number.isNaN(seenAt) || Date.now() - seenAt > CLICK_ID_MAX_AGE_MS) return {};

  const out: ClickIdRecord = {};
  CLICK_ID_PARAMS.forEach((name) => {
    if (record[name]) out[name] = record[name];
  });
  return out;
}

/** Test seam. */
export function _resetAttribution(): void {
  try {
    window.localStorage.removeItem(FIRST_TOUCH_KEY);
    window.localStorage.removeItem(LAST_TOUCH_KEY);
    window.localStorage.removeItem(CLICK_ID_KEY);
  } catch {
    /* ignore */
  }
}
