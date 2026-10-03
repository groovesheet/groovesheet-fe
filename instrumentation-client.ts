import posthog, { type CaptureResult } from 'posthog-js';

// Google's link checkers (each YouTube description edit sends a few) and
// headless browsers: hundreds of one-pageview "visitors" a day.
const BOT_UA = /Google-Safety|Googlebot|bot\b|crawler|spider|HeadlessChrome|Lighthouse|PageSpeed/i;

/** Drop bot traffic and cross-origin "Script error." exceptions (no stack, nothing to act on). */
function dropNoise(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null;
  if (typeof navigator !== 'undefined' && (navigator.webdriver || BOT_UA.test(navigator.userAgent))) return null;
  if (event.event === '$exception') {
    const values = event.properties?.$exception_values;
    if (Array.isArray(values) && values.length === 1 && values[0] === 'Script error.') return null;
  }
  return event;
}

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

// Without a token or host there is nothing to send to, so PostHog is simply
// not started. Locally that is the normal case (the token lives in Vercel):
// say so once in the console rather than throwing, which used to break the
// page's hydration in `next dev`.
if (!projectToken || !host) {
  if (process.env.NODE_ENV === 'development') {
    console.info(
      `[analytics] PostHog is off: NEXT_PUBLIC_POSTHOG_${projectToken ? 'HOST' : 'PROJECT_TOKEN'} is not set.`
    );
  }
} else {
  posthog.init(projectToken, {
    // Sent through our own domain (vercel.json rewrites /ingest to PostHog US):
    // about a quarter of uploading sessions never reached PostHog directly
    // (ad blockers), and posthog.com is unreliable from mainland China.
    api_host: '/ingest',
    ui_host: host.replace('.i.posthog.com', '.posthog.com'),
    defaults: '2026-01-30',
    person_profiles: 'identified_only',
    capture_pageview: 'history_change',
    capture_pageleave: true,
    capture_exceptions: true,
    persistence: 'localStorage+cookie',
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-ph-mask]',
    },
    debug: process.env.NODE_ENV === 'development',
    before_send: dropNoise,
  });
}
