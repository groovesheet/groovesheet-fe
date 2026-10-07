/**
 * A plan or pack picked on the pricing cards while signed out, remembered
 * across the sign-in that has to happen first.
 *
 * Before this, the card opened the login modal and forgot the choice: Google
 * sign-in reloads the page, email sign-in reloads it too, and the visitor was
 * left looking at the same pricing cards with nothing happening. On 2026-10-06
 * a visitor picked Pro annual, signed up with Google, and then sat on the page
 * for 15 minutes without ever reaching Checkout. The pricing section reads this
 * back once the visitor is signed in and opens Checkout for what they picked.
 */

export interface CheckoutIntent {
  /** Backend plan key ('tier2_annual', 'topup-60', ...). */
  plan: string;
  /** Currency the card was quoted in, so Checkout charges the price they saw. */
  currency?: string;
  savedAt: number;
}

const KEY = 'gs_checkout_intent';
// Long enough to sign up by email code; short enough that a visitor who gave
// up on signing in is not thrown into Checkout on some later sign-in.
const MAX_AGE_MS = 15 * 60 * 1000;

export function saveCheckoutIntent(plan: string, currency?: string): void {
  try {
    const value: CheckoutIntent = { plan, currency, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* storage disabled: the visitor just has to click again after signing in */
  }
}

/** The intent, if a fresh one is waiting. Reading it removes it, so it runs once. */
export function takeCheckoutIntent(): CheckoutIntent | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as Partial<CheckoutIntent> | null;
    if (!parsed || typeof parsed.plan !== 'string' || !parsed.plan) return null;
    if (Date.now() - (parsed.savedAt || 0) > MAX_AGE_MS) return null;
    return parsed as CheckoutIntent;
  } catch {
    return null;
  }
}
