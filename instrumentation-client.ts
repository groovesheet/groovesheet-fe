import posthog from 'posthog-js';

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
    api_host: host,
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
  });
}
