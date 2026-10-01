'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth';
import { createCheckoutSession } from '@/lib/api';
import { startProviderCheckout } from '@/lib/airwallex';
import { getClickIds } from '@/lib/attribution';
import { FUNNEL, trackFunnel } from '@/lib/analytics';
import useBillingCatalog, { formatMoney } from '@/lib/useBillingCatalog';
import { scrollToPricing } from '@/lib/scrollToPricing';
import { Button } from '@/components/ui/Button';
import type { GetToken } from '@/lib/types';

/**
 * What the upload cards show when the server answers 402 (out of minutes).
 *
 * It used to be a silent scroll to the pricing section: the upload vanished and
 * the page jumped, which reads as a glitch rather than a price. In the live
 * Stripe account's whole history no visitor ever reached Checkout. This says
 * what happened in the server's own words and puts the cheapest way to finish
 * the song one click away.
 */

/**
 * 'out_of_minutes': a signed-in account asked for the full song (402).
 * 'signed_out': "Get the full song" pressed before signing in. Free accounts
 * have no minutes, so signing up never finishes the song on its own; the price
 * is shown first, and the pack picked here goes straight to Checkout once the
 * visitor has signed in (lib/fullSongIntent).
 */
export type PaywallMode = 'out_of_minutes' | 'signed_out';

interface PaywallState {
  message: string | null;
  previewId?: string | null;
  mode: PaywallMode;
}

export interface PaywallOptions {
  /** Signed-out mode: remember the pack (or null for "just sign in") and open sign-in. */
  onSignInToBuy?: (plan: string | null) => void;
  /** Called just before leaving for Checkout, so the preview can be found again on return. */
  onBeforeCheckout?: (plan: string) => void;
}

/** Create a Checkout session for a pack or plan and leave for the provider's page. */
export async function openCheckout(plan: string, getToken: GetToken, currency: string | null = null): Promise<void> {
  const data = await createCheckoutSession('/api', plan, getToken, null, currency, getClickIds());
  await startProviderCheckout(data);
}

const panel: CSSProperties = {
  width: '100%',
  maxWidth: 440,
  background: 'var(--color-panel1)',
  borderRadius: 13,
  padding: 26,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  boxShadow: '0 20px 60px rgba(0,0,0,.5)',
};
const muted: CSSProperties = { margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--color-muted-foreground)' };
const row: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 12px',
  border: '1px solid var(--color-input-border)',
  borderRadius: 10,
};

function OutOfMinutesModal({
  state,
  surface,
  options,
  onClose,
}: {
  state: PaywallState;
  surface: string;
  options: PaywallOptions;
  onClose: (reason: string) => void;
}) {
  const { getToken } = useAuth();
  const { catalog, currency } = useBillingCatalog();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signedOut = state.mode === 'signed_out';

  const buy = async (checkoutKey: string) => {
    setError(null);
    if (signedOut) {
      trackFunnel(FUNNEL.PAYWALL_SIGN_IN, { plan: checkoutKey, surface, preview_id: state.previewId || undefined });
      onClose('sign_in_to_buy');
      options.onSignInToBuy?.(checkoutKey);
      return;
    }
    setBusy(checkoutKey);
    trackFunnel(FUNNEL.BEGIN_CHECKOUT, { plan: checkoutKey, source: 'paywall', surface, preview_id: state.previewId || undefined });
    try {
      options.onBeforeCheckout?.(checkoutKey);
      await openCheckout(checkoutKey, getToken, currency);
    } catch (err) {
      const message = (err instanceof Error && err.message) || 'Could not start checkout. Please try again.';
      trackFunnel(FUNNEL.CHECKOUT_ERROR, { plan: checkoutKey, source: 'paywall', message });
      setError(message);
      setBusy(null);
    }
  };

  const topups = (catalog?.topups || []).filter((t) => typeof t.checkout_id === 'string');

  return createPortal(
    <div
      role="presentation"
      onClick={() => onClose('backdrop')}
      style={{ position: 'fixed', inset: 0, zIndex: 2147483646, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', padding: 20 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={signedOut ? 'Get the full song' : 'Out of minutes'}
        onClick={(e) => e.stopPropagation()}
        style={panel}
      >
        <div style={{ fontSize: 19, fontWeight: 500, color: 'var(--color-text)' }}>
          {signedOut ? 'Get the full song' : <>You&apos;re out of minutes</>}
        </div>
        {signedOut ? (
          <p style={muted}>
            The 10-second preview is free. The full song uses minutes from a minute pack or a monthly plan. Pick one and
            sign in to pay; you come straight back to this song.
          </p>
        ) : (
          <p style={muted}>
            {state.message || 'Transcribing the full song uses minutes from a plan or a minute pack.'} Your preview stays
            here while you top up.
          </p>
        )}
        {error && <p style={{ margin: 0, fontSize: 13, color: '#FF6B7A' }}>{error}</p>}
        {topups.map((topup) => {
          const key = topup.checkout_id as string;
          const minutes = typeof topup.minutes === 'number' ? Math.round(topup.minutes) : null;
          return (
            <div key={key} style={row}>
              <div style={{ color: 'var(--color-text)', fontSize: 14 }}>
                {minutes != null ? `${minutes} minutes` : topup.display_name}
                <span style={{ color: 'var(--color-muted-foreground)' }}>
                  {' '}
                  · {formatMoney(topup.price ?? topup.price_usd, currency)} once
                </span>
              </div>
              <Button size="small" disabled={busy !== null} onClick={() => buy(key)}>
                {busy === key ? 'Opening…' : signedOut ? 'Choose' : 'Buy'}
              </Button>
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            size="small"
            onClick={() => {
              onClose('see_plans');
              scrollToPricing({ tab: 'plans' });
            }}
          >
            See monthly plans
          </Button>
          {signedOut && (
            <Button
              variant="secondary"
              size="small"
              onClick={() => {
                trackFunnel(FUNNEL.PAYWALL_SIGN_IN, { surface, preview_id: state.previewId || undefined });
                onClose('sign_in');
                options.onSignInToBuy?.(null);
              }}
            >
              I have a plan: sign in
            </Button>
          )}
          <Button variant="secondary" size="small" onClick={() => onClose('not_now')}>
            Not now
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * `showPaywall(message, previewId, mode)` opens the dialog and records it; the
 * returned `paywall` element must be rendered by the caller.
 */
export function usePaywall(
  surface: string,
  options: PaywallOptions = {}
): {
  showPaywall: (message: string | null, previewId?: string | null, mode?: PaywallMode) => void;
  paywall: ReactNode;
} {
  const [state, setState] = useState<PaywallState | null>(null);
  const stateRef = useRef<PaywallState | null>(null);

  const showPaywall = useCallback(
    (message: string | null, previewId?: string | null, mode: PaywallMode = 'out_of_minutes') => {
      const next = { message, previewId, mode };
      stateRef.current = next;
      setState(next);
      trackFunnel(FUNNEL.PAYWALL_SHOWN, { surface, mode, message: message || undefined, preview_id: previewId || undefined });
    },
    [surface]
  );

  const close = useCallback(
    (reason: string) => {
      trackFunnel(FUNNEL.PAYWALL_DISMISSED, {
        surface,
        reason,
        mode: stateRef.current?.mode,
        preview_id: stateRef.current?.previewId || undefined,
      });
      stateRef.current = null;
      setState(null);
    },
    [surface]
  );

  useEffect(() => {
    if (!state) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close('escape');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, close]);

  return {
    showPaywall,
    paywall: state ? <OutOfMinutesModal state={state} surface={surface} options={options} onClose={close} /> : null,
  };
}

export default OutOfMinutesModal;
