/**
 * Never-throw GA4/GTM + PostHog event wrapper.
 *
 * The site loads GTM (`GTM-P9XDD5Z7`) which forwards to GA4 (`G-LJ5P8PF3YH`).
 * Everything here pushes onto `window.dataLayer`, mirrors the same event into
 * PostHog (see lib/observability.ts) and, for the two events Meta can bid on,
 * into the Meta Pixel loaded in components/chrome/SiteScripts.tsx, and swallows every failure:
 * an ad blocker, a missing container, a serialisation error or a consent
 * refusal must never break Explore playback, downloads, signup or purchase.
 *
 * Funnel events (FUNNEL below, plus sign_up and purchase) are also posted to
 * our own API, POST /funnel/events, so the upload-to-payment funnel survives
 * ad blockers and can be joined to preview and payment rows server-side
 * (groovesheet-be scripts/funnel_report.py).
 *
 * Event names follow the funnel contract. `sign_up` and `purchase` use GA4's
 * recommended names so the standard reports pick them up.
 *
 * Register these as GA4 custom dimensions before relying on the reports:
 *   gs_track_id, gs_source_platform, gs_campaign, gs_content, gs_video_id
 */

import { attributionProps } from '@/lib/attribution';
import { phCapture } from '@/lib/observability';

type Primitive = string | number | boolean;
export type EventProps = Record<string, unknown>;

/** Anything with a track id and slug: a library track, a card, a workflow. */
export interface TrackLike {
  id?: string | null;
  track_id?: string | null;
  slug?: string | null;
}

export interface ConversionValue {
  value?: number;
  currency?: string;
  transaction_id?: string;
}

export const EVENTS = {
  EXPLORE_TRACK_VIEW: 'explore_track_view',
  TRACK_PLAY: 'track_play',
  TRACK_STEM_SOLO: 'track_stem_solo',
  SCORE_VIEW: 'score_view',
  TRACK_DOWNLOAD_INTENT: 'track_download_intent',
  TRACK_DOWNLOAD: 'track_download',
  SIGN_UP: 'sign_up',
  EXPLORE_UPLOAD_CTA: 'explore_upload_cta_click',
  WORKFLOW_STARTED: 'workflow_started',
  PURCHASE: 'purchase',
} as const;

/**
 * Upload-to-payment funnel. Built 2026-09-29 to test one hypothesis: visitors
 * watch the 10-second preview, dislike it, and leave. Nobody had ever reached
 * Stripe Checkout, and nothing measured the steps in between.
 *
 * Keep in step with ALLOWED_EVENTS in groovesheet-be routes/funnel.py; the
 * server drops names it does not know.
 */
export const FUNNEL = {
  UPLOAD_STARTED: 'upload_started',
  PREVIEW_READY: 'preview_ready',
  PREVIEW_FAILED: 'preview_failed',
  PREVIEW_PLAYED: 'preview_played',
  PREVIEW_RATING: 'preview_rating',
  /** Once per preview: how long it was on screen, and whether they played it or asked for more. */
  PREVIEW_EXIT: 'preview_exit',
  /** Signed-out "sign up" click on a preview. */
  UNLOCK_CLICK: 'unlock_click',
  PREVIEW_CLAIMED: 'preview_claimed',
  /** Signed-in "transcribe the full song" click. */
  FULL_SONG_CLICK: 'full_song_click',
  /** Out of minutes (HTTP 402). */
  PAYWALL_SHOWN: 'paywall_shown',
  PAYWALL_DISMISSED: 'paywall_dismissed',
  BEGIN_CHECKOUT: 'begin_checkout',
  CHECKOUT_ERROR: 'checkout_error',
  FULL_SONG_STARTED: 'full_song_started',
  PRICING_VIEW: 'pricing_view',
} as const;

const FIRST_PARTY_EVENTS = new Set<string>([...Object.values(FUNNEL), EVENTS.SIGN_UP, EVENTS.PURCHASE]);

// Same origin: next.config rewrites /api to the API, so no CORS is involved,
// which is what lets the exit event go out through sendBeacon.
const FUNNEL_ENDPOINT = '/api/funnel/events';
const FUNNEL_SESSION_KEY = 'gs_funnel_sid';
const FUNNEL_BATCH_MAX = 25;
const FUNNEL_FLUSH_MS = 1500;

type FunnelItem = { event: string; props: Record<string, Primitive>; preview_id?: string };
let funnelQueue: FunnelItem[] = [];
let funnelTimer: ReturnType<typeof setTimeout> | null = null;
let funnelUserId: string | null = null;
let funnelListening = false;
let memorySessionId: string | null = null;

/**
 * A random id kept in localStorage. It outlives sign-up, which is the point:
 * the anonymous upload and the account that later pays land in one session.
 */
function funnelSessionId(): string {
  try {
    const existing = window.localStorage.getItem(FUNNEL_SESSION_KEY);
    if (existing) return existing;
  } catch {
    /* storage blocked: fall back to a per-page id below */
  }
  if (!memorySessionId) {
    const random =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    memorySessionId = `s_${random.replace(/-/g, '')}`.slice(0, 40);
  }
  try {
    window.localStorage.setItem(FUNNEL_SESSION_KEY, memorySessionId);
  } catch {
    /* ignore */
  }
  return memorySessionId;
}

/** Attach the signed-in account to subsequent funnel events (null on sign-out). */
export function setFunnelUser(userId: string | null | undefined): void {
  funnelUserId = userId ? String(userId) : null;
}

/**
 * Send whatever is queued. On page exit (`beacon`), sendBeacon is the only
 * transport the browser reliably lets finish; otherwise a keepalive fetch.
 * text/plain keeps it a CORS "simple" request. Never throws.
 */
export function flushFunnel(beacon = false): void {
  try {
    if (funnelTimer) {
      clearTimeout(funnelTimer);
      funnelTimer = null;
    }
    while (funnelQueue.length) {
      const events = funnelQueue.splice(0, FUNNEL_BATCH_MAX);
      const body = JSON.stringify({ session_id: funnelSessionId(), user_id: funnelUserId || undefined, events });
      if (beacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        if (navigator.sendBeacon(FUNNEL_ENDPOINT, new Blob([body], { type: 'text/plain' }))) continue;
      }
      if (typeof fetch === 'function') {
        fetch(FUNNEL_ENDPOINT, {
          method: 'POST',
          body,
          headers: { 'Content-Type': 'text/plain' },
          keepalive: true,
          credentials: 'omit',
        }).catch(() => {});
      }
    }
  } catch {
    /* measurement is best-effort */
  }
}

function sendFirstParty(eventName: string, props: Record<string, Primitive>): void {
  if (!FIRST_PARTY_EVENTS.has(eventName)) return;
  if (!funnelListening) {
    funnelListening = true;
    window.addEventListener('pagehide', () => flushFunnel(true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushFunnel(true);
    });
  }
  const previewId = typeof props.preview_id === 'string' ? props.preview_id : undefined;
  funnelQueue.push({ event: eventName, props, preview_id: previewId });
  // Tracked while the page is going away (the preview exit event is): the
  // flush-on-hide listener may already have run, and a timer would never
  // fire, so send it now by beacon.
  if (document.visibilityState === 'hidden') {
    flushFunnel(true);
  } else if (funnelQueue.length >= FUNNEL_BATCH_MAX) {
    flushFunnel();
  } else if (!funnelTimer) {
    funnelTimer = setTimeout(() => flushFunnel(), FUNNEL_FLUSH_MS);
  }
}

/** Test hook: forget queued events and the cached user. */
export function _resetFunnel(): void {
  funnelQueue = [];
  if (funnelTimer) clearTimeout(funnelTimer);
  funnelTimer = null;
  funnelUserId = null;
  memorySessionId = null;
}

/**
 * Google Ads conversions.
 *
 * Google Ads does not read the dataLayer events above. It needs its own
 * `conversion` event sent through the AW- tag configured in components/chrome/SiteScripts.tsx.
 * GTM would be the usual place to wire this, but the container on this site
 * (`GTM-P9XDD5Z7`) belongs to a different Google account than the Ads login,
 * so the call has to live in the app.
 *
 * `purchase` is deliberately absent: that conversion is configured in Google Ads
 * as a page-load rule on /billing/success, which already fires on the redirect
 * back from Stripe and Airwallex. Sending an event here as well would
 * double-count every payment.
 */
const ADS_ID = 'AW-18426875153';

export const ADS_LABELS = {
  SIGN_UP: 'A2rWCNukmu0cEJGaz9JE',
  // The account's Purchase conversion action. Read from the environment
  // because the label is account configuration, not code: it comes from
  // Google Ads > Goals > Conversions > Purchase > Tag setup, and pasting it
  // into Vercel is a deploy rather than a release. Unset, adsConversion()
  // below no-ops, so a missing label costs the conversion but never the sale.
  PURCHASE: process.env.NEXT_PUBLIC_ADS_PURCHASE_LABEL || '',
};

/**
 * Send one Google Ads conversion. Returns true when it reached gtag.
 *
 * Never throws. A missing `gtag` (ad blocker, consent refusal, or the tag
 * simply not loaded yet) is a silent no-op, on the same principle as track():
 * measurement must never break signup.
 */
export function adsConversion(label: string, { value, currency, transaction_id }: ConversionValue = {}): boolean {
  try {
    if (!label || typeof label !== 'string') return false;
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return false;
    const payload: Record<string, Primitive> = {
      send_to: `${ADS_ID}/${label}`,
      value: typeof value === 'number' ? value : 1.0,
      currency: currency || 'SGD',
    };
    // Google deduplicates on this, so a refresh of the success page or a
    // Stripe retry cannot inflate the conversion count, and, now that a real
    // amount is attached, cannot inflate reported revenue either.
    if (transaction_id) payload.transaction_id = transaction_id;
    window.gtag('event', 'conversion', payload);
    return true;
  } catch {
    return false;
  }
}

/**
 * The subset of the funnel that maps onto a Meta standard event. Only the two
 * bottom-of-funnel actions go across: Meta's optimiser wants the event it is
 * bidding for, and forwarding the whole funnel would add noise the campaigns
 * never optimise against. GA4 and PostHog still receive everything.
 *
 * Unlike Google Ads, `purchase` is included. The double-count that adsConversion()
 * avoids comes from a Google Ads page-load rule on /billing/success; Meta has no
 * equivalent rule, so this is the only place the pixel hears about a payment.
 */
const META_EVENTS: Record<string, string> = {
  sign_up: 'CompleteRegistration',
  purchase: 'Purchase',
};

/**
 * Forward one event to the Meta Pixel. Never throws, and no-ops when the pixel
 * did not load (ad blocker, or the snippet removed), same principle as track().
 */
function metaCapture(eventName: string, props: Record<string, Primitive>): void {
  try {
    const metaName = META_EVENTS[eventName];
    if (!metaName || typeof window === 'undefined' || typeof window.fbq !== 'function') return;
    const params: Record<string, Primitive> = {};
    if (props.value !== undefined) params.value = props.value;
    if (props.currency !== undefined) params.currency = props.currency;
    // Meta deduplicates on this, so a reloaded success page cannot inflate the
    // conversion count, exactly as transaction_id does for Google.
    if (props.transaction_id !== undefined) params.eventID = props.transaction_id;
    window.fbq('track', metaName, params);
  } catch {
    /* pixel reporting is best-effort */
  }
}

/**
 * Values GA4 must never receive. Raw IPs, cookie values and tokens are
 * stripped defensively even though no call site sends them today.
 */
const FORBIDDEN_KEYS = /^(ip|ip_address|raw_ip|gs_anon|cookie|token|access_token|refresh_token|password|authorization)$/i;

function sanitize(props: unknown): Record<string, Primitive> {
  const out: Record<string, Primitive> = {};
  if (!props || typeof props !== 'object') return out;
  const source = props as Record<string, unknown>;
  Object.keys(source).forEach((key) => {
    if (FORBIDDEN_KEYS.test(key)) return;
    const value = source[key];
    if (value === undefined || value === null) return;
    // Only primitives cross into the dataLayer: an accidental object could
    // carry unexpected personal data and would not be a usable dimension.
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    }
  });
  return out;
}

/**
 * Push one event. Returns true when it reached the dataLayer.
 * Never throws, whatever the arguments or the page state.
 */
export function track(eventName: string, props: EventProps = {}): boolean {
  try {
    if (!eventName || typeof eventName !== 'string') return false;
    if (typeof window === 'undefined') return false;

    // GTM may not have created the array yet, or may never load at all.
    if (!Array.isArray(window.dataLayer)) {
      window.dataLayer = window.dataLayer || [];
    }
    if (!Array.isArray(window.dataLayer)) return false;

    const payload = {
      ...sanitize(attributionProps()),
      ...sanitize(props),
    };
    window.dataLayer.push({ event: eventName, ...payload });
    // Same taxonomy, second sink. PostHog no-ops until a key is configured.
    phCapture(eventName, payload);
    sendFirstParty(eventName, payload);
    metaCapture(eventName, payload);
    return true;
  } catch {
    return false;
  }
}

/** Common per-track properties shared by every track-scoped event. */
export function trackProps(track_: TrackLike | null | undefined): { gs_track_id?: string | null; gs_track_slug?: string | null } {
  if (!track_) return {};
  return {
    gs_track_id: track_.id || track_.track_id,
    gs_track_slug: track_.slug,
  };
}

// --- Funnel helpers --------------------------------------------------------
// Thin named wrappers so call sites stay readable and property names cannot
// drift between components.

/** Fires once per resolved Explore track view. */
export function trackExploreView(track_: TrackLike | null | undefined, extra: EventProps = {}): boolean {
  return track(EVENTS.EXPLORE_TRACK_VIEW, { ...trackProps(track_), ...extra });
}

export function trackPlay(track_: TrackLike | null | undefined, extra: EventProps = {}): boolean {
  return track(EVENTS.TRACK_PLAY, { ...trackProps(track_), ...extra });
}

export function trackStemSolo(track_: TrackLike | null | undefined, extra: EventProps = {}): boolean {
  return track(EVENTS.TRACK_STEM_SOLO, { ...trackProps(track_), ...extra });
}

export function trackScoreView(track_: TrackLike | null | undefined, extra: EventProps = {}): boolean {
  return track(EVENTS.SCORE_VIEW, { ...trackProps(track_), ...extra });
}

/** Fires before any authentication prompt, so intent is measured even if the user bounces. */
export function trackDownloadIntent(track_: TrackLike | null | undefined, extra: EventProps = {}): boolean {
  return track(EVENTS.TRACK_DOWNLOAD_INTENT, { ...trackProps(track_), ...extra });
}

export function trackDownload(track_: TrackLike | null | undefined, extra: EventProps = {}): boolean {
  return track(EVENTS.TRACK_DOWNLOAD, { ...trackProps(track_), ...extra });
}

/**
 * Fires once per genuinely new account: lib/auth gates this on account age and
 * a localStorage marker, so the Google Ads conversion is not re-sent on the
 * signed-in user's later page loads.
 */
export function trackSignUp(method?: string | null): boolean {
  const pushed = track(EVENTS.SIGN_UP, { method: method || 'unknown' });
  adsConversion(ADS_LABELS.SIGN_UP);
  return pushed;
}

/**
 * The bridge from a free library page to the paid transcription flow. Every
 * marketing asset points at /explore, which is free to download, so this is the
 * only place that measures intent to cross into the paid product.
 */
export function trackExploreUploadCta(track_: TrackLike | null | undefined, extra: EventProps = {}): boolean {
  return track(EVENTS.EXPLORE_UPLOAD_CTA, { ...trackProps(track_), ...extra });
}

export function trackWorkflowStarted(workflowName: string, extra: EventProps = {}): boolean {
  return track(EVENTS.WORKFLOW_STARTED, { workflow_name: workflowName, ...extra });
}

/**
 * Send the purchase to Google Ads as a named event, with no conversion label.
 *
 * The labelled path above is the precise one, but it needs a label that only
 * exists in the Ads UI. This is the second, label-free route Google documents
 * for the Google tag: an event addressed to the Ads destination by name, which
 * a conversion action configured for the `purchase` event will pick up. The
 * account's Purchase action is an Ads-created "account default", and no label
 * for it was ever configured in the code or in the GTM container, so this is
 * the route most likely to be the one it is actually listening on.
 *
 * Both are sent because they cost nothing together and fail in opposite
 * directions: the labelled call is exact but silent while unconfigured, this
 * one needs no configuration but depends on how the action was set up. They
 * carry the same `transaction_id`, which is precisely what Google deduplicates
 * on, so if both land the sale is still counted once.
 */
export function adsPurchaseEvent({ value, currency, transaction_id }: ConversionValue = {}): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return false;
    const payload: Record<string, Primitive | undefined> = {
      send_to: ADS_ID,
      value: typeof value === 'number' ? value : undefined,
      currency: currency || undefined,
    };
    if (transaction_id) payload.transaction_id = transaction_id;
    window.gtag('event', 'purchase', payload);
    return true;
  } catch {
    return false;
  }
}

/**
 * A completed payment, reported to every sink that needs it.
 *
 * `value` is the amount actually charged, read back from Stripe server-side
 * (see BillingSuccess). It is not optional decoration: without it the Google
 * Ads Purchase conversion carries no revenue, bidding cannot learn what a
 * customer is worth, and return on ad spend is not computable. Reporting the
 * conversion here rather than through a URL-based rule in the Ads UI is what
 * makes attaching that amount possible at all.
 */
export function trackPurchase({ value, currency, transaction_id, tier }: ConversionValue & { tier?: string } = {}): boolean {
  const pushed = track(EVENTS.PURCHASE, { value, currency, transaction_id, tier });
  // Two routes to Google Ads; see adsPurchaseEvent for why both, and why
  // sending both cannot double-count.
  adsConversion(ADS_LABELS.PURCHASE, { value, currency, transaction_id });
  adsPurchaseEvent({ value, currency, transaction_id });
  return pushed;
}

/** One step of the upload-to-payment funnel (see FUNNEL). */
export function trackFunnel(eventName: (typeof FUNNEL)[keyof typeof FUNNEL], props: EventProps = {}): boolean {
  return track(eventName, props);
}
