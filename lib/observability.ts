/**
 * PostHog + Microsoft Clarity bootstrap.
 *
 * This sits *underneath* lib/analytics.ts: that module owns the event taxonomy
 * and the GTM/GA4 sink, and calls into here so the same events also reach
 * PostHog. Nothing in this file throws: an ad blocker, a missing key or a
 * storage failure must never break playback, signup or checkout.
 *
 * Both tools are opt-in by configuration:
 *   NEXT_PUBLIC_POSTHOG_KEY   PostHog project API key (phc_...). Unset => no PostHog.
 *   NEXT_PUBLIC_POSTHOG_HOST  optional, defaults to PostHog US cloud.
 *   NEXT_PUBLIC_CLARITY_ID    Clarity project id. Unset => no Clarity.
 *
 * Why both: PostHog gives funnels + retention + session replay keyed to a
 * user id; Clarity gives unlimited free replay and heatmaps with no event
 * budget. They answer different halves of "why did this user not come back".
 *
 * Privacy: PostHog runs with `person_profiles: 'identified_only'`, so anonymous
 * visitors never get a person profile, and all text input is masked in replays.
 */
import type { PostHog } from 'posthog-js';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;

let posthog: PostHog | null = null;
let posthogReady = false;
let clarityReady = false;

async function initPosthog(): Promise<void> {
  if (posthogReady || !POSTHOG_KEY || typeof window === 'undefined') return;
  try {
    // Loaded on demand so a missing or blocked bundle cannot break boot, and
    // so pages without a key never download it.
    const ph = (await import('posthog-js')).default;
    ph.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: 'identified_only',
      // Client-side navigations change the URL through the history API.
      capture_pageview: 'history_change',
      capture_pageleave: true,
      capture_exceptions: true,
      persistence: 'localStorage+cookie',
      // Session replay is the point of this integration: it is what answers
      // "what did the users who never came back actually see".
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '[data-ph-mask]',
      },
    });
    posthog = ph;
    posthogReady = true;
  } catch {
    posthog = null;
  }
}

function initClarity(): void {
  if (clarityReady || !CLARITY_ID || typeof window === 'undefined') return;
  try {
    const queue: unknown[] = [];
    const clarity = Object.assign((...args: unknown[]) => {
      queue.push(args);
    }, { q: queue });
    window.clarity = window.clarity || clarity;
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.clarity.ms/tag/${CLARITY_ID}`;
    document.head.appendChild(tag);
    clarityReady = true;
  } catch {
    clarityReady = false;
  }
}

/**
 * Boot both tools. Idempotent; safe to call on every load. No-ops entirely
 * when neither key is configured, which is the state in any environment that
 * has not had the keys set yet.
 */
export function initObservability(): void {
  try {
    void initPosthog();
    initClarity();
  } catch {
    /* never break app startup */
  }
}

/** Mirror one taxonomy event into PostHog. Called by lib/analytics.ts. */
export function phCapture(eventName: string, props?: Record<string, unknown>): void {
  try {
    if (posthogReady && posthog) posthog.capture(eventName, props);
  } catch {
    /* swallow */
  }
}

/**
 * Bind the current session to a signed-in user so funnels and replays are
 * attributable across devices. Safe to call before init or with a null user.
 */
export function identifyUser(user: { id?: string | null; email?: string | null } | null | undefined): void {
  if (!user || !user.id) return;
  try {
    if (posthogReady && posthog) {
      posthog.identify(String(user.id), {
        email: user.email || undefined,
      });
    }
  } catch {
    /* swallow */
  }
  try {
    if (clarityReady && typeof window !== 'undefined' && window.clarity) {
      // Clarity's custom-id is hashed on ingest; pass the opaque user id only.
      window.clarity('identify', String(user.id));
    }
  } catch {
    /* swallow */
  }
}

/** Clear identity on sign-out so the next user starts a clean session. */
export function resetObservability(): void {
  try {
    if (posthogReady && posthog) posthog.reset();
  } catch {
    /* swallow */
  }
}

/** True when PostHog actually initialised, useful for debugging in console. */
export function observabilityStatus(): { posthog: boolean; clarity: boolean } {
  return { posthog: posthogReady, clarity: clarityReady };
}
