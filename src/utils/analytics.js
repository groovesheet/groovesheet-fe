/**
 * Never-throw GA4/GTM + PostHog event wrapper.
 *
 * The site loads GTM (`GTM-P9XDD5Z7`) which forwards to GA4 (`G-LJ5P8PF3YH`).
 * Everything here pushes onto `window.dataLayer`, mirrors the same event into
 * PostHog (see utils/observability.js), and swallows every failure:
 * an ad blocker, a missing container, a serialisation error or a consent
 * refusal must never break Explore playback, downloads, signup or purchase.
 *
 * Event names follow the funnel contract. `sign_up` and `purchase` use GA4's
 * recommended names so the standard reports pick them up.
 *
 * Register these as GA4 custom dimensions before relying on the reports:
 *   gs_track_id, gs_source_platform, gs_campaign, gs_content, gs_video_id
 */

import { attributionProps } from './attribution';
import { phCapture } from './observability';

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
};

/**
 * Google Ads conversions.
 *
 * Google Ads does not read the dataLayer events above. It needs its own
 * `conversion` event sent through the AW- tag configured in public/index.html.
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
  PURCHASE: process.env.REACT_APP_ADS_PURCHASE_LABEL || '',
};

/**
 * Send one Google Ads conversion. Returns true when it reached gtag.
 *
 * Never throws. A missing `gtag` — ad blocker, consent refusal, or the tag
 * simply not loaded yet — is a silent no-op, on the same principle as track():
 * measurement must never break signup.
 */
export function adsConversion(label, { value, currency, transaction_id } = {}) {
  try {
    if (!label || typeof label !== 'string') return false;
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return false;
    const payload = {
      send_to: `${ADS_ID}/${label}`,
      value: typeof value === 'number' ? value : 1.0,
      currency: currency || 'SGD',
    };
    // Google deduplicates on this, so a refresh of the success page or a
    // Stripe retry cannot inflate the conversion count — and, now that a real
    // amount is attached, cannot inflate reported revenue either.
    if (transaction_id) payload.transaction_id = transaction_id;
    window.gtag('event', 'conversion', payload);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Values GA4 must never receive. Raw IPs, cookie values and tokens are
 * stripped defensively even though no call site sends them today.
 */
const FORBIDDEN_KEYS = /^(ip|ip_address|raw_ip|gs_anon|cookie|token|access_token|refresh_token|password|authorization)$/i;

function sanitize(props) {
  const out = {};
  if (!props || typeof props !== 'object') return out;
  Object.keys(props).forEach((key) => {
    if (FORBIDDEN_KEYS.test(key)) return;
    const value = props[key];
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
export function track(eventName, props = {}) {
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
    return true;
  } catch (e) {
    return false;
  }
}

/** Common per-track properties shared by every track-scoped event. */
export function trackProps(track_) {
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
export function trackExploreView(track_, extra = {}) {
  return track(EVENTS.EXPLORE_TRACK_VIEW, { ...trackProps(track_), ...extra });
}

export function trackPlay(track_, extra = {}) {
  return track(EVENTS.TRACK_PLAY, { ...trackProps(track_), ...extra });
}

export function trackStemSolo(track_, extra = {}) {
  return track(EVENTS.TRACK_STEM_SOLO, { ...trackProps(track_), ...extra });
}

export function trackScoreView(track_, extra = {}) {
  return track(EVENTS.SCORE_VIEW, { ...trackProps(track_), ...extra });
}

/** Fires before any authentication prompt, so intent is measured even if the user bounces. */
export function trackDownloadIntent(track_, extra = {}) {
  return track(EVENTS.TRACK_DOWNLOAD_INTENT, { ...trackProps(track_), ...extra });
}

export function trackDownload(track_, extra = {}) {
  return track(EVENTS.TRACK_DOWNLOAD, { ...trackProps(track_), ...extra });
}

/**
 * Fires once per genuinely new account — auth.js gates this on account age and
 * a localStorage marker, so the Google Ads conversion is not re-sent on the
 * signed-in user's later page loads.
 */
export function trackSignUp(method) {
  const pushed = track(EVENTS.SIGN_UP, { method: method || 'unknown' });
  adsConversion(ADS_LABELS.SIGN_UP);
  return pushed;
}

/**
 * The bridge from a free library page to the paid transcription flow. Every
 * marketing asset points at /explore, which is free to download, so this is the
 * only place that measures intent to cross into the paid product.
 */
export function trackExploreUploadCta(track_, extra = {}) {
  return track(EVENTS.EXPLORE_UPLOAD_CTA, { ...trackProps(track_), ...extra });
}

export function trackWorkflowStarted(workflowName, extra = {}) {
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
 * for it was ever configured in the code or in the GTM container — so this is
 * the route most likely to be the one it is actually listening on.
 *
 * Both are sent because they cost nothing together and fail in opposite
 * directions: the labelled call is exact but silent while unconfigured, this
 * one needs no configuration but depends on how the action was set up. They
 * carry the same `transaction_id`, which is precisely what Google deduplicates
 * on, so if both land the sale is still counted once.
 */
export function adsPurchaseEvent({ value, currency, transaction_id } = {}) {
  try {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return false;
    const payload = {
      send_to: ADS_ID,
      value: typeof value === 'number' ? value : undefined,
      currency: currency || undefined,
    };
    if (transaction_id) payload.transaction_id = transaction_id;
    window.gtag('event', 'purchase', payload);
    return true;
  } catch (e) {
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
export function trackPurchase({ value, currency, transaction_id, tier } = {}) {
  const pushed = track(EVENTS.PURCHASE, { value, currency, transaction_id, tier });
  // Two routes to Google Ads; see adsPurchaseEvent for why both, and why
  // sending both cannot double-count.
  adsConversion(ADS_LABELS.PURCHASE, { value, currency, transaction_id });
  adsPurchaseEvent({ value, currency, transaction_id });
  return pushed;
}
