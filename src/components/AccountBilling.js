import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';
import { useAuth, useAuthActions, useUser } from '../auth';
import Header from './layout/Header';
import Footer from './layout/Footer';
import SkeletonPanel from './ui/SkeletonPanel';
import StatusMessage from './ui/StatusMessage';
import {
  fetchAccountSummary,
  fetchAccountUsageHistory,
  fetchBillingPlans,
  fetchPaymentMethod,
  createCheckoutSession,
  createBillingPortalSession,
  cancelSubscription,
} from '../utils/api';
import { startProviderCheckout } from '../utils/airwallex';
import config from '../config';

const PAGE_SIZE = 20;

// Map a backend tier id -> a friendly display name + plan family.
const TIER_LABELS = {
  free: 'Free',
  lite_monthly: 'Lite',
  lite_annual: 'Lite',
  pro_monthly: 'Pro',
  pro_annual: 'Pro',
};
const tierFamily = (tier) => (tier || 'free').split('_')[0]; // free | lite | pro
const tierLabel = (tier) => TIER_LABELS[tier] || 'Free';

// Legacy fallback checkout codes, used only when /billing/plans is unavailable
// (offline fallback cards). The live catalog carries the authoritative
// `checkout_id` per plan/top-up — always prefer that.
const CHECKOUT_CODE = {
  lite: { monthly: 'tier2', annual: 'tier2_annual' },
  pro: { monthly: 'tier3', annual: 'tier3_annual' },
};

const humanizeType = (type) => {
  if (!type) return '—';
  const spaced = String(type).replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const formatDate = (isoString) => {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const fmtBalance = (m) => (Number.isInteger(m) ? String(m) : Number(m).toFixed(1));
const formatMinutes = (minutes) => {
  if (minutes == null) return '—';
  const rounded = Math.round(minutes * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded} min`;
};

const PHcheck = (
  <svg width="17" height="17" viewBox="0 0 256 256" fill="var(--color-primary)" style={{ flex: '0 0 auto', marginTop: 1 }}>
    <path d="M229.66 77.66l-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69 218.34 66.34a8 8 0 0 1 11.32 11.32Z" />
  </svg>
);

export const AccountBilling = () => {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { signOut } = useAuthActions();
  const { isSignedIn, isLoaded } = useUser();

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(null);

  const [catalog, setCatalog] = useState({ plans: [], topups: [], provider: 'stripe', currency: 'usd' });
  const [payment, setPayment] = useState(null);

  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState(null);

  const [billingMode, setBillingMode] = useState('monthly');
  const [portalLoading, setPortalLoading] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const notify = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  }, []);

  const handleAuthError = useCallback(
    (err) => {
      if (err && err.isAuthError) {
        setTimeout(() => navigate('/'), 2000);
        return true;
      }
      return false;
    },
    [navigate]
  );

  // Account summary + public catalog + payment method.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        setSummaryLoading(true);
        const data = await fetchAccountSummary(config.apiBaseUrl, getToken, signOut);
        if (!cancelled) {
          setSummary(data);
          setSummaryError(null);
        }
      } catch (err) {
        if (cancelled) return;
        if (handleAuthError(err)) setSummaryError('Your session has expired. You have been logged out.');
        else setSummaryError(err.message);
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();
    // Public catalog (no auth).
    fetchBillingPlans(config.apiBaseUrl)
      .then((c) => !cancelled && setCatalog({ plans: c?.plans || [], topups: c?.topups || [], provider: c?.provider || 'stripe' }))
      .catch(() => {});
    // Payment method is best-effort — section hides if the endpoint is missing.
    fetchPaymentMethod(config.apiBaseUrl, getToken, signOut)
      .then((p) => !cancelled && setPayment(p))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, signOut, handleAuthError]);

  // Usage history (paginated).
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        setUsageLoading(true);
        const data = await fetchAccountUsageHistory(
          config.apiBaseUrl,
          getToken,
          { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
          signOut
        );
        if (!cancelled) {
          setTransactions(Array.isArray(data?.transactions) ? data.transactions : []);
          setTotal(typeof data?.total === 'number' ? data.total : 0);
          setUsageError(null);
        }
      } catch (err) {
        if (cancelled) return;
        if (handleAuthError(err)) setUsageError('Your session has expired. You have been logged out.');
        else setUsageError(err.message);
        setTransactions([]);
      } finally {
        if (!cancelled) setUsageLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, signOut, page, handleAuthError]);

  const openPortal = async (msg) => {
    notify(msg || 'Opening Stripe billing portal…');
    setPortalLoading(true);
    try {
      const { url } = await createBillingPortalSession(config.apiBaseUrl, getToken, signOut);
      if (url) window.location.assign(url);
      else notify("Couldn't open the billing portal. Please try again.");
    } catch (err) {
      if (!handleAuthError(err)) notify("Couldn't open the billing portal. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  };

  // Currency the backend quoted this visitor in ("usd", or "cny" for
  // mainland-China traffic). The fallback cards below are USD-only, so they
  // stay in dollars if the catalog never loads.
  const currency = catalog.currency || 'usd';
  const money = (value) => `${currency === 'cny' ? '¥' : '$'}${value}`;
  // Prefer the catalog's currency-specific fields, falling back to the USD
  // ones so a cached response from an older backend still renders.
  const planMonthly = (p) => p?.price_monthly ?? p?.price_monthly_usd;
  const planAnnual = (p) => p?.price_annual ?? p?.price_annual_usd;

  const startCheckout = async (planCode, label) => {
    notify(`Opening checkout — ${label}`);
    try {
      const data = await createCheckoutSession(config.apiBaseUrl, planCode, getToken, signOut, currency);
      await startProviderCheckout(data);
    } catch (err) {
      if (!handleAuthError(err)) notify("Couldn't start checkout. Please try again.");
    }
  };

  const handleBack = () => navigate('/');

  // ---- derived ----
  const subscription = summary?.subscription || {};
  const tier = subscription.tier || 'free';
  const family = tierFamily(tier);
  const isFree = family === 'free';
  const isPaid = !isFree;
  const isActive = subscription.is_active !== false;
  const isInactive = isPaid && subscription.is_active === false;

  const balanceMinutes =
    typeof subscription.balance_minutes === 'number'
      ? subscription.balance_minutes
      : typeof subscription.balance_seconds === 'number'
        ? subscription.balance_seconds / 60
        : 0;

  // allowance: minutes_per_month for the matching plan. The free tier grants
  // no monthly minutes (allowance null) — its balance is top-ups/leftovers
  // only, so there's no "of N min this cycle" to show.
  const currentPlan = catalog.plans.find((p) => tierFamily(p.id) === family);
  const hasAllowance = (currentPlan?.minutes_per_month ?? 0) > 0;
  const allowance = hasAllowance
    ? currentPlan.minutes_per_month
    : isFree
      ? null
      : Math.max(balanceMinutes, 1);
  const pct = Math.max(0, Math.min(1, allowance ? balanceMinutes / allowance : 0));
  const ringDeg = `${(pct * 360).toFixed(0)}deg`;
  const ringPctLabel = `${Math.round(pct * 100)}%`;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = page + 1;
  const canPrev = page > 0;
  const canNext = (page + 1) * PAGE_SIZE < total;
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total);

  const annual = billingMode === 'annual';
  const isAirwallex = catalog.provider === 'airwallex';

  // Airwallex has no hosted billing portal, so "manage" = cancel in-app, and
  // "update card" = re-run the recurring checkout for the current plan (the
  // backend cancels the old subscription and re-subscribes with the new card).
  const cancelPlan = async () => {
    if (!window.confirm('Cancel your subscription? You keep access until the end of the current billing period.')) return;
    notify('Requesting cancellation…');
    try {
      await cancelSubscription(config.apiBaseUrl, getToken, signOut);
      notify('Cancellation requested — your plan will not renew.');
    } catch (err) {
      if (!handleAuthError(err)) notify("Couldn't cancel. Please try again.");
    }
  };
  const manageSubscription = () => (isAirwallex ? cancelPlan() : openPortal());
  const updateCard = () => {
    if (!isAirwallex) return openPortal('Opening Stripe billing portal to update payment…');
    const liveForMode = catalog.plans.find(
      (p) => tierFamily(p.id) === family && p.id.endsWith(annual ? '_annual' : '_monthly')
    );
    const code = liveForMode?.checkout_id || CHECKOUT_CODE[family]?.[billingMode];
    if (!code) return notify('No active plan to update.');
    return startCheckout(code, `Update card — ${tierLabel(tier)}`);
  };

  // Build the two plan cards (Lite, Pro) from the live catalog, with fallbacks.
  const PLAN_FALLBACK = {
    lite: { name: 'Lite', badge: 'PROFESSIONAL', subtitle: 'Best for working musicians', monthly: 10, annual: 7.5, annualBilled: 90, features: ['120 minutes / month', 'Downloads: PDF, MusicXML, MIDI', '500 MB upload / file', 'Batch processing', 'Rollover up to 240 min'] },
    pro: { name: 'Pro', badge: 'ENTERPRISE', subtitle: 'For studios & power users', monthly: 18, annual: 15, annualBilled: 180, features: ['Everything in Lite', '300 minutes / month', 'Fast processing queue', '1 GB upload / file', 'Rollover up to 600 min'] },
  };
  const planCards = ['lite', 'pro'].map((fam) => {
    const fb = PLAN_FALLBACK[fam];
    const live = catalog.plans.find((p) => tierFamily(p.id) === fam);
    const monthly = planMonthly(live) ?? fb.monthly;
    const liveAnnual = planAnnual(live);
    const annualP = liveAnnual ? Math.round((liveAnnual / 12) * 100) / 100 : fb.annual;
    const annualBilled = liveAnnual ?? fb.annualBilled;
    const price = annual ? annualP : monthly;
    const isCurrent = isPaid && family === fam;
    const featured = fam === 'lite';
    const features = live
      ? [
          `${live.minutes_per_month} minutes / month`,
          'Downloads: PDF, MusicXML, MIDI',
          live.max_rollover ? `Rollover up to ${live.max_rollover} min` : 'Batch processing',
        ]
      : fb.features;
    return {
      fam,
      name: fb.name,
      badge: fb.badge,
      subtitle: fb.subtitle,
      priceText: money(price),
      period: annual ? '/mo, billed yearly' : '/month',
      billedNote: annual ? `Billed ${money(annualBilled)} per year` : '',
      features,
      isCurrent,
      showTag: isCurrent || featured,
      tagText: isCurrent ? 'CURRENT PLAN' : 'MOST POPULAR',
      border: isCurrent || featured ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
      ctaLabel: (isFree ? 'Choose ' : family === 'lite' && fam === 'pro' ? 'Upgrade to ' : 'Switch to ') + fb.name,
      onChoose: () => {
        if (isCurrent) return manageSubscription();
        const liveForMode = catalog.plans.find(
          (p) => tierFamily(p.id) === fam && p.id.endsWith(annual ? '_annual' : '_monthly')
        );
        const code = liveForMode?.checkout_id || CHECKOUT_CODE[fam][billingMode];
        return startCheckout(code, `${fb.name} (${billingMode})`);
      },
    };
  });

  const TOPUP_FALLBACK = [
    { id: 'topup-30', display_name: 'Starter', minutes: 30, price_usd: 4, priority_queue: false },
    { id: 'topup-60', display_name: 'Plus', minutes: 60, price_usd: 7, priority_queue: true },
    { id: 'topup-120', display_name: 'Power', minutes: 120, price_usd: 12, priority_queue: true },
  ];
  const topupCards = (catalog.topups.length ? catalog.topups : TOPUP_FALLBACK).map((t) => ({
    id: t.id,
    name: t.display_name,
    minutes: t.minutes,
    priority: t.priority_queue,
    priceText: money(t.price ?? t.price_usd),
    onBuy: () => startCheckout(t.checkout_id || t.id, `+${t.minutes} min top-up`),
  }));

  // ---- styles ----
  const pageStyle = {
    position: 'relative',
    minHeight: '100vh',
    background: 'var(--color-background)',
    fontFamily: 'var(--font-family-sans)',
    WebkitFontSmoothing: 'antialiased',
    overflowX: 'hidden',
  };
  const dots = {
    position: 'fixed',
    inset: 0,
    backgroundImage: 'radial-gradient(circle, var(--color-dot-pattern) 1.5px, transparent 1.5px)',
    backgroundSize: '43px 43px',
    opacity: 0.35,
    pointerEvents: 'none',
    zIndex: 0,
  };
  // 1414 + 2×20 gutter: lines the content up with the nav bar (Header.css).
  const main = { position: 'relative', zIndex: 1, maxWidth: 1454, margin: '0 auto', padding: '48px 20px 110px' };
  const card = {
    background: 'var(--color-panel2)',
    borderRadius: 13,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  };
  const label = { fontFamily: 'var(--font-family-alt)', fontSize: 16, color: 'var(--color-muted-foreground)' };
  const h2 = { fontSize: 24, lineHeight: '32px', color: 'var(--color-foreground)', margin: 0, fontWeight: 400 };
  const muted = { fontFamily: 'var(--font-family-alt)', fontSize: 15, color: 'var(--color-muted-foreground)' };
  const seg = (active) => ({
    fontSize: 14,
    border: 'none',
    borderRadius: 7,
    padding: '8px 16px',
    cursor: 'pointer',
    fontFamily: 'var(--font-family-sans)',
    whiteSpace: 'nowrap',
    transition: 'all .2s ease',
    background: active ? 'var(--color-primary)' : 'transparent',
    color: active ? '#fff' : 'var(--color-muted-foreground)',
    fontWeight: 500,
  });
  const th = {
    textAlign: 'left',
    padding: '15px 20px',
    fontFamily: 'var(--font-family-alt)',
    fontSize: 15,
    fontWeight: 500,
    color: 'var(--color-muted-foreground)',
    background: 'var(--color-panel3)',
    borderBottom: '1px solid var(--color-border)',
  };
  const td = {
    padding: '16px 20px',
    fontSize: 16,
    color: 'var(--color-foreground)',
    borderBottom: '1px solid var(--color-border)',
  };

  // ---- signed out ----
  if (isLoaded && !isSignedIn) {
    return (
      <div style={pageStyle}>
        <div style={dots} />
        <Header />
        <main style={main}>
          <button className="back-button" onClick={handleBack}>
            <ArrowLeft size={28} weight="regular" />
            <span>Back</span>
          </button>
          <div style={{ marginTop: 48, maxWidth: 540, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <h1 style={{ fontSize: 40, lineHeight: '52px', letterSpacing: '-.8px', color: 'var(--color-text)', margin: 0, fontWeight: 400 }}>
              Billing &amp; Usage
            </h1>
            <p style={{ ...muted, fontSize: 19, lineHeight: 1.5 }}>
              You're signed out. Sign in to view your plan, minutes balance, and usage history.
            </p>
            <div>
              <button className="gs-btn gs-btn-primary" onClick={handleBack}>Go to home</button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const isLoading = summaryLoading;

  return (
    <div style={pageStyle}>
      <BillingButtonStyles />
      <div style={dots} />
      <Header />

      <main style={main}>
        <button className="back-button" onClick={handleBack} style={{ marginBottom: 36 }}>
          <ArrowLeft size={28} weight="regular" />
          <span>Back</span>
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 60 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 40, lineHeight: '52px', letterSpacing: '-.8px', color: 'var(--color-text)', margin: 0, fontWeight: 400, maxWidth: 480 }}>
              Billing &amp; Usage
            </h1>
            <p style={{ fontFamily: 'var(--font-family-alt)', fontSize: 20, lineHeight: 1.4, color: 'var(--color-text)', margin: 0, maxWidth: 372 }}>
              Manage your plan, track minutes, and review your usage history.
            </p>
          </div>

          {isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} aria-busy="true">
              <SkeletonPanel count={1} height={190} bare />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
                <SkeletonPanel count={3} height={150} bare />
              </div>
            </div>
          )}

          {!isLoading && summaryError && (
            <StatusMessage variant="error" title="Couldn't load your plan">
              {summaryError}
            </StatusMessage>
          )}

          {!isLoading && !summaryError && (
            <>
              {/* Past-due alert */}
              {isInactive && (
                <div role="alert" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: 'rgba(255,107,107,.09)', border: '1px solid var(--color-danger)', borderRadius: 13, padding: '18px 20px' }}>
                  <svg width="22" height="22" viewBox="0 0 256 256" fill="var(--color-danger)" style={{ flex: '0 0 auto', marginTop: 1 }}>
                    <path d="M236.8 188.09 149.35 36.22a24.76 24.76 0 0 0-42.7 0L19.2 188.09a23.51 23.51 0 0 0 0 23.72A24.35 24.35 0 0 0 40.55 224h174.9a24.35 24.35 0 0 0 21.33-12.19 23.51 23.51 0 0 0 .02-23.72ZM120 104a8 8 0 0 1 16 0v40a8 8 0 0 1-16 0Zm8 88a12 12 0 1 1 12-12 12 12 0 0 1-12 12Z" />
                  </svg>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, color: 'var(--color-text)', fontWeight: 500 }}>We couldn't process your latest payment</div>
                    <div style={{ ...muted, marginTop: 3 }}>Update your payment method to keep your plan active. Your minutes won't refill until billing is restored.</div>
                  </div>
                  <button className="gs-btn gs-btn-primary" style={{ flex: '0 0 auto' }} onClick={updateCard}>
                    Update payment
                  </button>
                </div>
              )}

              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
                <div style={card}>
                  <span style={label}>Current plan</span>
                  <span style={{ fontSize: 30, lineHeight: 1.1, color: 'var(--color-foreground)' }}>{tierLabel(tier)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 'auto' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-family-alt)', fontSize: 14, lineHeight: 1, padding: '5px 11px', borderRadius: 6, background: isActive ? 'var(--color-primary)' : 'rgba(255,107,107,.13)', color: isActive ? '#fff' : 'var(--color-danger)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />
                      {isActive ? 'Active' : 'Payment issue'}
                    </span>
                    {subscription.next_recharge_at && (
                      <span style={muted}>{isFree ? 'Resets' : 'Renews'} {formatDate(subscription.next_recharge_at)}</span>
                    )}
                  </div>
                </div>

                <div style={card}>
                  <span style={label}>Minutes remaining</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
                    <div>
                      <div style={{ fontSize: 52, fontWeight: 300, lineHeight: 1, color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtBalance(Math.round(balanceMinutes * 10) / 10)}
                      </div>
                      <div style={{ ...muted, marginTop: 7 }}>minutes left</div>
                    </div>
                    <div role="img" aria-label={`${ringPctLabel} of monthly minutes remaining`} style={{ position: 'relative', width: 92, height: 92, borderRadius: '50%', flex: '0 0 auto', display: 'grid', placeItems: 'center', background: `conic-gradient(var(--color-primary) ${ringDeg}, var(--color-border) 0)` }}>
                      <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'var(--color-panel2)', display: 'grid', placeItems: 'center' }}>
                        <span style={{ fontSize: 16, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>{ringPctLabel}</span>
                      </div>
                    </div>
                  </div>
                  <span style={{ ...muted, fontSize: 14, marginTop: 'auto' }}>
                    {allowance
                      ? `${fmtBalance(Math.round(balanceMinutes * 10) / 10)} of ${allowance} min this cycle`
                      : 'No monthly allowance — buy a plan or top-up for minutes'}
                  </span>
                </div>

                <div style={card}>
                  <span style={label}>Plan actions</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'auto' }}>
                    {isInactive && (
                      <button className="gs-btn gs-btn-primary gs-btn-full" onClick={updateCard}>
                        Update payment
                      </button>
                    )}
                    {isPaid && isActive && (
                      <button className="gs-btn gs-btn-primary gs-btn-full" onClick={() => document.getElementById('plans-section')?.scrollIntoView({ behavior: 'smooth' })}>
                        Buy more minutes
                      </button>
                    )}
                    {isFree && (
                      <button className="gs-btn gs-btn-primary gs-btn-full" onClick={() => document.getElementById('plans-section')?.scrollIntoView({ behavior: 'smooth' })}>
                        Upgrade plan
                      </button>
                    )}
                    {isPaid && (
                      <button className="gs-btn gs-btn-secondary gs-btn-full" disabled={portalLoading} onClick={manageSubscription}>
                        {portalLoading ? 'Opening…' : isAirwallex ? 'Cancel subscription' : 'Manage subscription'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Plans & top-ups */}
              <div id="plans-section" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={h2}>{isFree ? 'Upgrade your plan' : 'Plans & top-ups'}</h2>
                    <p style={{ ...muted, margin: '4px 0 0' }}>
                      {isFree ? 'Unlock more minutes, downloads, and faster processing.' : 'Change your plan or grab a one-time top-up.'}
                    </p>
                  </div>
                  <div role="radiogroup" aria-label="Billing period" style={{ display: 'flex', gap: 4, background: 'var(--color-panel3)', borderRadius: 9, padding: 4 }}>
                    <button role="radio" aria-checked={billingMode === 'monthly'} onClick={() => setBillingMode('monthly')} style={seg(billingMode === 'monthly')}>Monthly</button>
                    <button role="radio" aria-checked={billingMode === 'annual'} onClick={() => setBillingMode('annual')} style={seg(billingMode === 'annual')}>Annual · 3 mo free</button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
                  {planCards.map((p) => (
                    <div key={p.fam} style={{ position: 'relative', background: 'var(--color-panel2)', border: p.border, borderRadius: 13, padding: '26px 24px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {p.showTag && (
                        <span style={{ position: 'absolute', top: -11, left: 24, fontFamily: 'var(--font-family-alt)', fontSize: 11, letterSpacing: '.6px', background: 'var(--color-primary)', color: '#fff', borderRadius: 6, padding: '4px 10px' }}>
                          {p.tagText}
                        </span>
                      )}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                        <h3 style={{ fontSize: 24, color: 'var(--color-foreground)', margin: 0, fontWeight: 500 }}>{p.name}</h3>
                        <span style={{ fontFamily: 'var(--font-family-alt)', fontSize: 11, letterSpacing: '.6px', color: 'var(--color-muted-foreground)' }}>{p.badge}</span>
                      </div>
                      <p style={{ ...muted, margin: 0 }}>{p.subtitle}</p>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 48, fontWeight: 300, lineHeight: 1, color: 'var(--color-foreground)' }}>{p.priceText}</span>
                        <span style={{ ...muted, paddingBottom: 6 }}>{p.period}</span>
                      </div>
                      <span style={{ ...muted, fontSize: 13, minHeight: 17 }}>{p.billedNote}</span>
                      <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                        {p.features.map((f, i) => (
                          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontFamily: 'var(--font-family-alt)', fontSize: 15, lineHeight: 1.35, color: 'var(--color-text)' }}>
                            {PHcheck}
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <div style={{ marginTop: 22 }}>
                        {p.isCurrent ? (
                          <button className="gs-btn gs-btn-secondary gs-btn-full" onClick={p.onChoose}>
                            <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M229.66 77.66l-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69 218.34 66.34a8 8 0 0 1 11.32 11.32Z" /></svg>
                            Current plan
                          </button>
                        ) : (
                          <button className="gs-btn gs-btn-primary gs-btn-full" onClick={p.onChoose}>{p.ctaLabel}</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h3 style={{ fontSize: 18, color: 'var(--color-foreground)', margin: 0, fontWeight: 500 }}>One-time top-ups</h3>
                  <p style={{ ...muted, margin: 0 }}>Need a quick boost? Buy minutes that never expire — no subscription change.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
                  {topupCards.map((t) => (
                    <div key={t.id} style={{ ...card, gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <span style={{ fontSize: 20, color: 'var(--color-foreground)', fontWeight: 500 }}>{t.name}</span>
                        {t.priority && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-family-alt)', fontSize: 12, color: 'var(--color-primary)', background: 'rgba(1,47,167,.1)', borderRadius: 6, padding: '4px 9px' }}>
                            <svg width="12" height="12" viewBox="0 0 256 256" fill="currentColor"><path d="M215.79 118.17a8 8 0 0 0-5-5.66L153.18 90.9l14.66-73.33a8 8 0 0 0-13.69-7l-112 120a8 8 0 0 0 3 13l57.63 21.61-14.62 73.34a8 8 0 0 0 13.69 7l112-120a8 8 0 0 0 1.94-7.95Z" /></svg>
                            Priority queue
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                        <span style={{ fontSize: 36, fontWeight: 300, lineHeight: 1, color: 'var(--color-foreground)' }}>{t.priceText}</span>
                        <span style={{ ...muted, fontSize: 14, paddingBottom: 5 }}>one-time</span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-family-alt)', fontSize: 15, color: 'var(--color-text)' }}>+{t.minutes} minutes added</span>
                      <span style={{ ...muted, fontSize: 13 }}>Never expire · all formats</span>
                      <div style={{ marginTop: 14 }}>
                        <button className="gs-btn gs-btn-secondary gs-btn-full" onClick={t.onBuy}>Buy {t.minutes} min</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment method (only when endpoint returns data) */}
              {isPaid && payment && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <h2 style={h2}>Payment method</h2>
                  <div style={{ ...card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 52, height: 34, borderRadius: 6, background: 'var(--color-panel3)', display: 'grid', placeItems: 'center' }}>
                        <svg width="26" height="26" viewBox="0 0 256 256" fill="var(--color-muted-foreground)"><path d="M224 48H32a16 16 0 0 0-16 16v128a16 16 0 0 0 16 16h192a16 16 0 0 0 16-16V64a16 16 0 0 0-16-16Zm0 16v24H32V64Zm0 128H32v-88h192v88Z" /></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 16, color: 'var(--color-foreground)' }}>{payment.brand} ending in {payment.last4}</div>
                        <div style={{ ...muted, fontSize: 14, marginTop: 2 }}>Expires {payment.exp} · managed securely</div>
                      </div>
                    </div>
                    <button className="gs-btn gs-btn-secondary" onClick={updateCard}>{isAirwallex ? 'Update card' : 'Manage payment method'}</button>
                  </div>
                </div>
              )}

              {/* Usage history */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <h2 style={h2}>Usage history</h2>
                  <span style={{ ...label }}>
                    {total === 0 ? 'No transactions' : `${total} transactions · showing ${rangeStart}–${rangeEnd}`}
                  </span>
                </div>

                {usageLoading && <SkeletonPanel count={4} height={52} />}

                {!usageLoading && usageError && (
                  <StatusMessage variant="error" title="Couldn't load usage history">{usageError}</StatusMessage>
                )}

                {!usageLoading && !usageError && transactions.length > 0 && (
                  <>
                    <div style={{ background: 'var(--color-panel2)', borderRadius: 13, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-family-sans)' }}>
                        <thead>
                          <tr>
                            <th style={th}>Date</th>
                            <th style={th}>Description</th>
                            <th style={th}>Type</th>
                            <th style={{ ...th, textAlign: 'right' }}>Minutes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map((tx) => {
                            const minutes = tx.amount_minutes;
                            const isSpend = typeof minutes === 'number' && minutes < 0;
                            return (
                              <tr key={tx.id}>
                                <td style={{ ...td, whiteSpace: 'nowrap' }}>{formatDate(tx.created_at)}</td>
                                <td style={td}>{tx.description || '—'}</td>
                                <td style={{ ...td, fontFamily: 'var(--font-family-alt)', fontSize: 15, color: 'var(--color-muted-foreground)', whiteSpace: 'nowrap' }}>{humanizeType(tx.transaction_type)}</td>
                                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: isSpend ? 'var(--color-muted-foreground)' : 'var(--color-primary)' }}>{formatMinutes(minutes)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                      <button className="gs-btn gs-btn-secondary" disabled={!canPrev} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</button>
                      <span style={muted}>Page {currentPage} of {totalPages}</span>
                      <button className="gs-btn gs-btn-secondary" disabled={!canNext} onClick={() => setPage((p) => p + 1)}>Next</button>
                    </div>
                  </>
                )}

                {!usageLoading && !usageError && transactions.length === 0 && (
                  <div style={{ background: 'var(--color-panel2)', borderRadius: 13, padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-panel3)', display: 'grid', placeItems: 'center' }}>
                      <svg width="26" height="26" viewBox="0 0 256 256" fill="var(--color-muted-foreground)"><path d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm0 192a88 88 0 1 1 88-88 88.1 88.1 0 0 1-88 88Zm45.66-93.66a8 8 0 0 1 0 11.32l-40 40a8 8 0 0 1-11.32 0l-20-20a8 8 0 0 1 11.32-11.32L128 156.69l34.34-34.35a8 8 0 0 1 11.32 0Z" /></svg>
                    </div>
                    <div style={{ fontSize: 18, color: 'var(--color-foreground)' }}>No usage yet</div>
                    <div style={{ ...muted, maxWidth: 340 }}>Once you transcribe a track or top up minutes, your credits and spending will appear here.</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />

      {toast && (
        <div role="status" style={{ position: 'fixed', left: 24, bottom: 24, zIndex: 70, background: 'rgba(20,20,22,.96)', color: '#fff', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, padding: '12px 18px', fontFamily: 'var(--font-family-alt)', fontSize: 14, boxShadow: '0 10px 40px rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4f7cff' }} />
          {toast}
        </div>
      )}
    </div>
  );
};

// Canonical GrooveSheet button styles, scoped via a single <style> injection so
// all three account pages can share the .gs-btn variants from the design.
export const BillingButtonStyles = () => (
  <style>{`
    .back-button{display:inline-flex;align-items:center;gap:8px;background:none;border:none;color:var(--color-text);cursor:pointer;padding:0;font-family:var(--font-family-sans);font-size:18px;transition:opacity .2s ease;}
    .back-button:hover{opacity:.7;}
    .gs-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 20px;border:1px solid transparent;border-radius:8px;font-family:var(--font-family-sans);font-size:14px;font-weight:500;line-height:1;cursor:pointer;white-space:nowrap;text-decoration:none;transition:background-color .2s ease,color .2s ease,border-color .2s ease;}
    .gs-btn-primary{background:var(--color-primary);color:#fff;}
    .gs-btn-primary:hover{background:#0139c7;}
    .gs-btn-secondary{background:transparent;color:var(--color-text);border-color:var(--color-border);}
    .gs-btn-secondary:hover{border-color:var(--color-primary);color:var(--color-primary);}
    .gs-btn-ghost{background:transparent;color:var(--color-muted-foreground);}
    .gs-btn-ghost:hover{color:var(--color-text);background:var(--color-surface-lightest);}
    .gs-btn-destructive{background:#e5484d;color:#fff;}
    .gs-btn-destructive:hover{background:#cf3b40;}
    .gs-btn-destructive-outline{background:transparent;color:var(--color-danger);border-color:color-mix(in srgb,var(--color-danger) 45%,transparent);}
    .gs-btn-destructive-outline:hover{background:var(--color-danger);color:#fff;}
    .gs-btn:disabled,.gs-btn[disabled]{background:var(--color-border);color:var(--color-muted-foreground);border-color:transparent;cursor:not-allowed;}
    .gs-btn-full{width:100%;}
    .gs-btn:focus-visible{outline:2px solid var(--color-primary);outline-offset:2px;}
  `}</style>
);

export default AccountBilling;
