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

/**
 * What the upload cards show when the server answers 402 (out of minutes).
 *
 * It used to be a silent scroll to the pricing section: the upload vanished and
 * the page jumped, which reads as a glitch rather than a price. In the live
 * Stripe account's whole history no visitor ever reached Checkout. This says
 * what happened in the server's own words and puts the cheapest way to finish
 * the song one click away.
 */

interface PaywallState {
  message: string | null;
  previewId?: string | null;
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
  onClose,
}: {
  state: PaywallState;
  surface: string;
  onClose: (reason: string) => void;
}) {
  const { getToken } = useAuth();
  const { catalog, currency } = useBillingCatalog();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buy = async (checkoutKey: string) => {
    setError(null);
    setBusy(checkoutKey);
    trackFunnel(FUNNEL.BEGIN_CHECKOUT, { plan: checkoutKey, source: 'paywall', surface, preview_id: state.previewId || undefined });
    try {
      const data = await createCheckoutSession('/api', checkoutKey, getToken, null, currency, getClickIds());
      await startProviderCheckout(data);
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
      <div role="dialog" aria-modal="true" aria-label="Out of minutes" onClick={(e) => e.stopPropagation()} style={panel}>
        <div style={{ fontSize: 19, fontWeight: 500, color: 'var(--color-text)' }}>You&apos;re out of minutes</div>
        <p style={muted}>
          {state.message || 'Transcribing the full song uses minutes from a plan or a minute pack.'} Your preview stays
          here while you top up.
        </p>
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
                {busy === key ? 'Opening…' : 'Buy'}
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
 * `showPaywall(message, previewId)` opens the dialog and records it; the
 * returned `paywall` element must be rendered by the caller.
 */
export function usePaywall(surface: string): {
  showPaywall: (message: string | null, previewId?: string | null) => void;
  paywall: ReactNode;
} {
  const [state, setState] = useState<PaywallState | null>(null);
  const stateRef = useRef<PaywallState | null>(null);

  const showPaywall = useCallback(
    (message: string | null, previewId?: string | null) => {
      const next = { message, previewId };
      stateRef.current = next;
      setState(next);
      trackFunnel(FUNNEL.PAYWALL_SHOWN, { surface, message: message || undefined, preview_id: previewId || undefined });
    },
    [surface]
  );

  const close = useCallback(
    (reason: string) => {
      trackFunnel(FUNNEL.PAYWALL_DISMISSED, { surface, reason, preview_id: stateRef.current?.previewId || undefined });
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
    paywall: state ? <OutOfMinutesModal state={state} surface={surface} onClose={close} /> : null,
  };
}

export default OutOfMinutesModal;
