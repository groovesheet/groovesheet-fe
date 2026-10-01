'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackPurchase } from '@/lib/analytics';
import { useAuth, useAuthActions } from '@/lib/auth';
import { fetchCheckoutSession } from '@/lib/api';
import config from '@/lib/config';
import { useLocalizedNavigate } from '@/lib/navigation-client';
import { loadFullSongIntent } from '@/lib/fullSongIntent';

/**
 * Landing page Stripe redirects to after a successful Checkout Session.
 *
 * The actual credit grant happens server-side via the webhook
 * (checkout.session.completed); this page just acknowledges the user
 * and points them at the next action. We deliberately don't trust the
 * `session_id` in the URL for anything authoritative.
 */
export default function BillingSuccess() {
  const params = useSearchParams();
  const navigate = useLocalizedNavigate();
  const sessionId = params.get('session_id');
  const { getToken } = useAuth();
  const { signOut } = useAuthActions();
  const [secondsLeft, setSecondsLeft] = useState(6);
  // Paid from a preview's "Get the full song": go back to that song, where the
  // upload card restores the preview and starts the full run by itself.
  // Otherwise, the history page as before.
  const [songPath] = useState<string | null>(() => loadFullSongIntent()?.path ?? null);
  const goNext = useCallback(() => {
    if (songPath) window.location.assign(songPath);
    else navigate('/account/history');
  }, [songPath, navigate]);

  // The purchase, reported to GA4 and to Google Ads. The webhook remains the
  // authority for the credit grant; this is what tells the ad platform a sale
  // happened and what it was worth.
  //
  // The amount is fetched rather than taken from the URL because the URL is
  // caller-controlled, and reported even when that fetch fails: a conversion
  // without a value is worth far more than no conversion at all. Keyed on the
  // session id so a refresh cannot double-count, and Google is given the same
  // id to deduplicate on independently.
  useEffect(() => {
    if (!sessionId) return;
    try {
      const key = `gs_purchase_${sessionId}`;
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, '1');
    } catch {
      /* storage unavailable: still report once for this page load */
    }

    const fallback = {
      transaction_id: sessionId,
      tier: params.get('plan') || undefined,
      currency: params.get('currency') || undefined,
    };

    fetchCheckoutSession(config.apiBaseUrl, sessionId, getToken, signOut)
      .then((session) => {
        trackPurchase({
          transaction_id: sessionId,
          tier: session.plan || fallback.tier,
          value: typeof session.value === 'number' ? session.value : undefined,
          currency: session.currency || fallback.currency,
        });
      })
      .catch(() => trackPurchase(fallback));
  }, [sessionId, params, getToken, signOut]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      goNext();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, goNext]);

  return (
    <section style={{ padding: '80px 24px', textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 16 }}>Payment complete</h1>
      <p style={{ marginBottom: 8 }}>
        Thanks, your plan is being activated. Credits will appear in your account momentarily.
      </p>
      {sessionId && (
        <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 24 }}>
          Reference: <code>{sessionId}</code>
        </p>
      )}
      <p style={{ marginBottom: 24 }}>
        {songPath ? 'Taking you back to your song' : 'Redirecting you to your history'} in {secondsLeft}s…
      </p>
      <button
        onClick={goNext}
        style={{
          padding: '10px 20px',
          borderRadius: 8,
          border: '1px solid currentColor',
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        Go now
      </button>
    </section>
  );
}
