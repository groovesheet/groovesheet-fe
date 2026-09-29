/**
 * PostHog + Microsoft Clarity bootstrap.
 *
 * This sits *underneath* lib/analytics.ts: that module owns the event taxonomy
 * and the GTM/GA4 sink, and calls into here so the same events also reach
 * PostHog. Nothing in this file throws: an ad blocker, a missing key or a
 * storage failure must never break playback, signup or checkout.
 *
 * Both tools are opt-in by configuration:
 *   NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN  PostHog project token. Unset => no PostHog.
 *   NEXT_PUBLIC_POSTHOG_HOST           PostHog ingestion host. Unset => no PostHog.
 *   NEXT_PUBLIC_CLARITY_ID             Clarity project id. Unset => no Clarity.
 *
 * Why both: PostHog gives funnels + retention + session replay keyed to a
 * user id; Clarity gives unlimited free replay and heatmaps with no event
 * budget. They answer different halves of "why did this user not come back".
 *
 * Privacy: PostHog runs with `person_profiles: 'identified_only'`, so anonymous
 * visitors never get a person profile, and all text input is masked in replays.
 */
const posthogReady = Boolean(
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST,
);
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;

let clarityReady = false;

/**
 * `instrumentation-client.ts` initializes this module once before the app
 * hydrates. Dynamic imports keep this bridge safe when it is evaluated by a
 * server component while still returning that same initialized SDK instance.
 */
function withPosthog(callback: (posthog: typeof import('posthog-js').default) => void): void {
  if (!posthogReady || typeof window === 'undefined') return;
  void import('posthog-js').then(({ default: posthog }) => callback(posthog)).catch(() => {});
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
 * Boot Clarity. PostHog initializes separately in instrumentation-client.ts.
 */
export function initObservability(): void {
  try {
    initClarity();
  } catch {
    /* never break app startup */
  }
}

/** Mirror one taxonomy event into PostHog. Called by lib/analytics.ts. */
export function phCapture(eventName: string, props?: Record<string, unknown>): void {
  try {
    withPosthog((posthog) => posthog.capture(eventName, props));
  } catch {
    /* swallow */
  }
}

/**
 * Dedicated PostHog Logs bridge. Only explicit calls to this function leave
 * the browser: existing console and application loggers remain local.
 */
export function phLog(message: string, attributes: Record<string, string | number | boolean> = {}): void {
  try {
    withPosthog((posthog) => posthog.logger.info(message, attributes));
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
    withPosthog((posthog) => {
      posthog.identify(String(user.id), {
        email: user.email || undefined,
      });
    });
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
    withPosthog((posthog) => posthog.reset());
  } catch {
    /* swallow */
  }
}

/** True when PostHog actually initialised, useful for debugging in console. */
export function observabilityStatus(): { posthog: boolean; clarity: boolean } {
  return { posthog: posthogReady, clarity: clarityReady };
}
