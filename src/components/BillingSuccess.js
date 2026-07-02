import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Landing page Stripe redirects to after a successful Checkout Session.
 *
 * The actual credit grant happens server-side via the webhook
 * (checkout.session.completed) — this page just acknowledges the user
 * and points them at the next action. We deliberately don't trust the
 * `session_id` in the URL for anything authoritative.
 */
function BillingSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get('session_id');
  const [secondsLeft, setSecondsLeft] = useState(6);

  useEffect(() => {
    if (secondsLeft <= 0) {
      navigate('/account/history');
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, navigate]);

  return (
    <section style={{ padding: '80px 24px', textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 16 }}>Payment complete</h1>
      <p style={{ marginBottom: 8 }}>
        Thanks — your plan is being activated. Credits will appear in your account momentarily.
      </p>
      {sessionId && (
        <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 24 }}>
          Reference: <code>{sessionId}</code>
        </p>
      )}
      <p style={{ marginBottom: 24 }}>
        Redirecting you to your history in {secondsLeft}s…
      </p>
      <button
        onClick={() => navigate('/account/history')}
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

export default BillingSuccess;
