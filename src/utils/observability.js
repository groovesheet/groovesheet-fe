/**
 * PostHog + Microsoft Clarity bootstrap.
 *
 * This sits *underneath* `utils/analytics.js`: that module owns the event
 * taxonomy and the GTM/GA4 sink, and calls into here so the same events also
 * reach PostHog. Nothing in this file throws — an ad blocker, a missing key or
 * a storage failure must never break playback, signup or checkout.
 *
 * Both tools are opt-in by configuration:
 *   REACT_APP_POSTHOG_KEY   — PostHog project API key (phc_...). Unset => no PostHog.
 *   REACT_APP_POSTHOG_HOST  — optional, defaults to PostHog US cloud.
 *   REACT_APP_CLARITY_ID    — Clarity project id. Unset => no Clarity.
 *
 * Why both: PostHog gives funnels + retention + session replay keyed to a
 * user id; Clarity gives unlimited free replay and heatmaps with no event
 * budget. They answer different halves of "why did this user not come back".
 *
 * Privacy: PostHog runs with `person_profiles: 'identified_only'`, so anonymous
 * visitors never get a person profile, and all text input is masked in replays.
 */

const POSTHOG_KEY = process.env.REACT_APP_POSTHOG_KEY;
const POSTHOG_HOST = process.env.REACT_APP_POSTHOG_HOST || 'https://us.i.posthog.com';
const CLARITY_ID = process.env.REACT_APP_CLARITY_ID;

let posthog = null;
let posthogReady = false;
let clarityReady = false;

/** Lazily require posthog-js so a missing/blocked bundle cannot break boot. */
function loadPosthog() {
  try {
    // eslint-disable-next-line global-require
    return require('posthog-js').default || require('posthog-js');
  } catch (e) {
    return null;
  }
}

function initPosthog() {
  if (posthogReady || !POSTHOG_KEY || typeof window === 'undefined') return;
  const ph = loadPosthog();
  if (!ph) return;
  try {
    ph.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: 'identified_only',
      // The app is a SPA; capture route changes rather than only the first load.
      capture_pageview: 'history_change',
      capture_pageleave: true,
      capture_exceptions: true,
      persistence: 'localStorage+cookie',
      // Session replay is the point of this integration — it is what answers
      // "what did the users who never came back actually see".
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '[data-ph-mask]',
      },
    });
    posthog = ph;
    posthogReady = true;
  } catch (e) {
    posthog = null;
  }
}

function initClarity() {
  if (clarityReady || !CLARITY_ID || typeof window === 'undefined') return;
  try {
    /* eslint-disable */
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1;
      t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_ID);
    /* eslint-enable */
    clarityReady = true;
  } catch (e) {
    clarityReady = false;
  }
}

/**
 * Boot both tools. Idempotent; safe to call from index.js on every load.
 * No-ops entirely when neither key is configured, which is the state in any
 * environment that has not had the keys set yet.
 */
export function initObservability() {
  try {
    initPosthog();
    initClarity();
  } catch (e) {
    /* never break app startup */
  }
}

/** Mirror one taxonomy event into PostHog. Called by utils/analytics.js. */
export function phCapture(eventName, props) {
  try {
    if (posthogReady && posthog) posthog.capture(eventName, props);
  } catch (e) {
    /* swallow */
  }
}

/**
 * Bind the current session to a signed-in user so funnels and replays are
 * attributable across devices. Safe to call before init or with a null user.
 */
export function identifyUser(user) {
  if (!user || !user.id) return;
  try {
    if (posthogReady && posthog) {
      posthog.identify(String(user.id), {
        email: user.email || undefined,
      });
    }
  } catch (e) {
    /* swallow */
  }
  try {
    if (clarityReady && typeof window !== 'undefined' && window.clarity) {
      // Clarity's custom-id is hashed on ingest; pass the opaque user id only.
      window.clarity('identify', String(user.id));
    }
  } catch (e) {
    /* swallow */
  }
}

/** Clear identity on sign-out so the next user starts a clean session. */
export function resetObservability() {
  try {
    if (posthogReady && posthog) posthog.reset();
  } catch (e) {
    /* swallow */
  }
}

/** True when PostHog actually initialised — useful for debugging in console. */
export function observabilityStatus() {
  return { posthog: posthogReady, clarity: clarityReady };
}
