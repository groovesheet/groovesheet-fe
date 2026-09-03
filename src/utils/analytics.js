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

export function trackSignUp(method) {
  return track(EVENTS.SIGN_UP, { method: method || 'unknown' });
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

export function trackPurchase({ value, currency, transaction_id, tier } = {}) {
  return track(EVENTS.PURCHASE, { value, currency, transaction_id, tier });
}
