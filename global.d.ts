/// <reference types="vitest/globals" />

/**
 * Globals that third-party tags put on window. Each one may be absent (ad
 * blocker, consent refusal, tag not loaded yet), so every caller checks first.
 */
type GtagFn = (...args: unknown[]) => void;

interface TrustpilotGlobal {
  loadFromElement: (element: HTMLElement, forceReload?: boolean) => void;
}

interface AirwallexCheckoutOptions {
  [key: string]: unknown;
}

interface AirwallexGlobal {
  init: (options: { env: string; origin: string }) => void;
  redirectToCheckout: (options: AirwallexCheckoutOptions) => unknown;
}

interface Window {
  dataLayer?: unknown[];
  gtag?: GtagFn;
  fbq?: GtagFn;
  clarity?: GtagFn & { q?: unknown[] };
  Trustpilot?: TrustpilotGlobal;
  Airwallex?: AirwallexGlobal;
}
