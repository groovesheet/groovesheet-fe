/**
 * Airwallex Hosted Payment Page helper.
 *
 * The backend's /billing/create-checkout-session returns either a Stripe hosted
 * URL (provider === 'stripe') or the ids + client_secret the Airwallex JS SDK
 * needs (provider === 'airwallex'). Airwallex has no server-returned URL on our
 * account, so the hosted card page is launched client-side via redirectToCheckout.
 *
 * The SDK is loaded on demand from Airwallex's CDN (no npm dep / build change).
 * NOTE: `checkout.airwallex.com` must be allowed by the site CSP (script-src).
 *
 * Env: REACT_APP_AIRWALLEX_ENV = 'demo' | 'prod' (defaults to 'demo').
 */

const AWX_ENV = process.env.REACT_APP_AIRWALLEX_ENV || 'demo';
const SDK_SRC = 'https://checkout.airwallex.com/assets/elements.bundle.min.js';

let sdkPromise = null;

function loadAirwallex() {
  if (typeof window !== 'undefined' && window.Airwallex) {
    return Promise.resolve(window.Airwallex);
  }
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SDK_SRC;
      script.async = true;
      script.onload = () => resolve(window.Airwallex);
      script.onerror = () => {
        sdkPromise = null;
        reject(new Error('Failed to load the Airwallex SDK'));
      };
      document.head.appendChild(script);
    });
  }
  return sdkPromise;
}

/**
 * Redirect the shopper to the Airwallex-hosted checkout page.
 * @param {object} data  the create-checkout-session response (provider==='airwallex')
 * @param {{successUrl: string, cancelUrl: string}} urls
 */
export async function redirectToAirwallexCheckout(data, { successUrl, cancelUrl }) {
  const Airwallex = await loadAirwallex();
  Airwallex.init({ env: AWX_ENV, origin: window.location.origin });

  const common = {
    env: AWX_ENV,
    currency: data.currency,
    client_secret: data.client_secret,
    successUrl,
    failUrl: cancelUrl,
  };

  if (data.mode === 'recurring') {
    // Subscription: collect + verify a saved-card consent. The backend creates
    // the subscription on the payment_consent.verified webhook.
    return Airwallex.redirectToCheckout({
      ...common,
      mode: 'recurring',
      customer_id: data.customer_id,
      recurringOptions: {
        next_triggered_by: 'merchant',
        merchant_trigger_reason: 'scheduled',
        currency: data.currency,
      },
    });
  }

  // One-time top-up.
  return Airwallex.redirectToCheckout({
    ...common,
    mode: 'payment',
    intent_id: data.intent_id,
    customer_id: data.customer_id,
  });
}

/**
 * Provider-agnostic checkout hand-off. Given a create-checkout-session response,
 * redirect the browser to whichever provider's hosted page applies.
 * @param {object} data
 * @param {{successUrl?: string, cancelUrl?: string}} [urls]
 */
export async function startProviderCheckout(data, urls = {}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const successUrl = urls.successUrl || `${origin}/billing/success`;
  const cancelUrl = urls.cancelUrl || `${origin}/pricing?canceled=1`;

  if (data && data.provider === 'airwallex') {
    return redirectToAirwallexCheckout(data, { successUrl, cancelUrl });
  }
  // Stripe (or any provider that returns a hosted URL).
  if (data && data.url) {
    window.location.assign(data.url);
    return undefined;
  }
  throw new Error('Checkout session did not return a redirect target.');
}
