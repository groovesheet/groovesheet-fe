'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useUser, useAuth } from '@/lib/auth';
import { createCheckoutSession } from '@/lib/api';
import useBillingCatalog, { formatMoney, walletNames } from '@/lib/useBillingCatalog';
import { startProviderCheckout } from '@/lib/airwallex';
import { PRICING_SECTION_ID, PRICING_TAB_EVENT } from '@/lib/scrollToPricing';
import { MAX_UPLOAD_MB } from '@/lib/constants';
import { getClickIds } from '@/lib/attribution';
import { saveCheckoutIntent, takeCheckoutIntent } from '@/lib/checkoutIntent';
import { FUNNEL, trackFunnel } from '@/lib/analytics';
import type { BillingPlan, BillingTopup } from '@/lib/types';
import { useLoginModal } from '@/components/chrome/LoginModalProvider';
import { useRouter } from '@/lib/navigation';
import StatusMessage from '@/components/ui/StatusMessage';
import type { FeaturesVariant } from './Features';
import './Pricing.css';

type PricingTab = 'plans' | 'topups';
type BillingMode = 'monthly' | 'annual';
type PlanSlug = 'free' | 'tier2' | 'tier3' | 'topup-30' | 'topup-60' | 'topup-120';

/**
 * Prices in the catalog's own currency, falling back to the USD fields so an
 * older/cached API response still renders.
 */
const planMonthly = (plan: BillingPlan | undefined) => plan?.price_monthly ?? plan?.price_monthly_usd;
const planAnnual = (plan: BillingPlan | undefined) => plan?.price_annual ?? plan?.price_annual_usd;
const topupAmount = (topup: BillingTopup | undefined) => topup?.price ?? topup?.price_usd;

/**
 * Format a minute count as a clean integer when whole (120 -> "120"), else keep
 * one decimal. Returns null for non-numbers so the caller can fall back.
 */
const formatMinutes = (value: number | null | undefined): string | null => {
  if (value == null || Number.isNaN(Number(value))) return null;
  const num = Number(value);
  return Number.isInteger(num) ? String(num) : String(parseFloat(num.toFixed(1)));
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

// The three check-mark variants from the design, one per card column.
const CheckFree = () => (
  <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.18799 8.92992L5.24999 11.9929L12.25 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CheckFeatured = () => (
  <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.85474 8.53502L5.91674 11.598L12.9167 4.59802" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CheckPro = () => (
  <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.52148 8.92992L5.58348 11.9929L12.5835 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ArrowOutline = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.0835 3.27991L10.4585 7.65491L6.0835 12.0299" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ArrowPrimary = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5.75 2.88501L10.125 7.26001L5.75 11.635" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function FeatureList({ check, items }: { check: ReactNode; items: ReactNode[] }) {
  return (
    <ul className="plan-features">
      {items.map((item, i) => (
        <li key={i} className="feature-item">
          {check}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

interface PricingProps {
  /** Defaults to the shared login modal. */
  onLoginClick?: () => void;
  /**
   * The page this section sits on. Stem separation has no transcription and
   * downloads WAV stems, so /stem-splitter swaps in copy that says so.
   */
  variant?: FeaturesVariant;
}

export default function Pricing({ onLoginClick, variant = 'notation' }: PricingProps) {
  const isStems = variant === 'stems';
  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { openLoginModal } = useLoginModal();
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState<PlanSlug | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PricingTab>('plans');
  const tabChosen = useRef(false);
  const chooseTab = (tab: PricingTab) => {
    tabChosen.current = true;
    setActiveTab(tab);
  };
  const [billingMode, setBillingMode] = useState<BillingMode>('annual');

  // Public pricing catalog from the backend (single source of truth for
  // numbers) plus the currency it quoted this visitor in.
  const { catalog, loading: catalogLoading, currency, wallets } = useBillingCatalog();
  const walletList = walletNames(wallets, t);
  const formatPrice = (value: number | null | undefined) => formatMoney(value, currency);

  // "Checkout canceled" notice, shown when checkout returns the user to /pricing?canceled.
  const [showCanceled, setShowCanceled] = useState(false);

  useEffect(() => {
    // Read once on arrival: the query string is only known in the browser,
    // and this section is prerendered without it.
    const params = new URLSearchParams(window.location.search);
    if (params.has('canceled')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the landing URL
      setShowCanceled(true);
    }
    // Arriving out of minutes: open on top-ups, the cheapest way to unblock.
    if (params.get('tab') === 'topups') {
      setActiveTab('topups');
    }
    if (params.has('tab')) tabChosen.current = true;
  }, []);

  // Visitors quoted in yuan open on top-ups: plans are subscriptions, which
  // Stripe bills to cards only, and most mainland buyers pay by Alipay or
  // WeChat. The first real checkout attempt (2026-10-01) was a mainland
  // visitor bouncing off a card-only Pro annual page. A tab the visitor (or
  // the URL) already picked is left alone.
  useEffect(() => {
    if (currency === 'cny' && !tabChosen.current) {
      setActiveTab('topups');
    }
  }, [currency]);

  // Same signal, but for the pricing section rendered in-page on the landing
  // and tool routes, where there is no navigation to carry a query string.
  useEffect(() => {
    const onTab = (e: Event) => {
      const detail = (e as CustomEvent<unknown>).detail;
      if (detail === 'topups' || detail === 'plans') {
        tabChosen.current = true;
        setActiveTab(detail);
      }
    };
    window.addEventListener(PRICING_TAB_EVENT, onTab);
    return () => window.removeEventListener(PRICING_TAB_EVENT, onTab);
  }, []);

  // Index catalog entries by id for easy lookup. Undefined until the API resolves.
  const planById = (id: string) => catalog?.plans?.find((p) => p.id === id);
  const topupById = (id: string) => catalog?.topups?.find((tp) => tp.id === id);

  /**
   * Resolve a UI plan slug + billing mode to the backend plan key.
   * The 'free' tier never hits checkout (no payment).
   */
  const resolvePlanKey = (plan: PlanSlug): string => {
    if (plan === 'tier2') return billingMode === 'annual' ? 'tier2_annual' : 'tier2';
    if (plan === 'tier3') return billingMode === 'annual' ? 'tier3_annual' : 'tier3';
    return plan; // topup-30 / topup-60 / topup-120
  };

  const handlePlanClick = async (plan: PlanSlug) => {
    setError(null);

    // Recorded before the sign-in wall, so intent to buy is measured even from
    // visitors who then abandon the login.
    if (plan !== 'free') {
      trackFunnel(FUNNEL.BEGIN_CHECKOUT, { plan: resolvePlanKey(plan), source: 'pricing', signed_in: Boolean(isSignedIn) });
    }

    if (!isSignedIn) {
      // Remember the pick: signing in reloads the page, and the visitor
      // should land in Checkout afterwards, not back on these cards.
      if (plan !== 'free') saveCheckoutIntent(resolvePlanKey(plan), currency);
      (onLoginClick ?? openLoginModal)();
      return;
    }

    // Free tier has no payment, and a signed-in visitor already has it. The
    // button used to return here and do nothing at all (PostHog logged it as
    // a dead click), so send them to the uploader: the one on this page when
    // there is one (home and tool pages), otherwise the home page's.
    if (plan === 'free') {
      const uploader = document.querySelector('.hero-container');
      if (uploader) uploader.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else router.push('/');
      return;
    }

    await startCheckout(plan, resolvePlanKey(plan), currency, 'pricing');
  };

  const startCheckout = async (slug: PlanSlug, planKey: string, quoted: string, source: string) => {
    setLoading(slug);
    try {
      // Send back the currency the user was actually quoted, so the price at
      // checkout can't differ from the price on the card they clicked.
      const data = await createCheckoutSession('/api', planKey, getToken, null, quoted, getClickIds());

      // Hand off to the provider's hosted checkout (Stripe URL or Airwallex SDK).
      await startProviderCheckout(data);
    } catch (err) {
      console.error('Error creating checkout session:', err);
      const message = errorMessage(err, 'Unexpected error starting checkout');
      trackFunnel(FUNNEL.CHECKOUT_ERROR, { plan: planKey, source, message });
      setError(message);
    } finally {
      setLoading(null);
    }
  };

  // Back from signing in with a card already picked: go straight on to
  // Checkout. Taking the intent clears it, so a second pricing section on the
  // same page (or a re-render) cannot open Checkout twice.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const intent = takeCheckoutIntent();
    if (!intent) return;
    const slug = intent.plan.replace(/_annual$/, '') as PlanSlug;
    trackFunnel(FUNNEL.BEGIN_CHECKOUT, { plan: intent.plan, source: 'after_signin', signed_in: true });
    void startCheckout(slug, intent.plan, intent.currency || currency, 'after_signin');
    // Runs once per sign-in; startCheckout and currency are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  // Seeing the prices is a funnel step of its own: once per page, when at
  // least a third of the section is on screen.
  const sectionRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          trackFunnel(FUNNEL.PRICING_VIEW, { path: window.location.pathname });
          observer.disconnect();
        }
      },
      { threshold: 0.33 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // --- Derived display values (API-driven, with graceful static fallbacks) ---
  // The free plan grants no processing minutes, so its card is static copy:
  // rendering the API's 0 would read "0 minutes / month".
  const liteMonthly = planById('lite_monthly');
  const liteAnnual = planById('lite_annual');
  const proMonthly = planById('pro_monthly');
  const proAnnual = planById('pro_annual');
  const starterTopup = topupById('starter');
  const plusTopup = topupById('plus');
  const powerTopup = topupById('power');

  // Per-month price for Lite: monthly plan's monthly price, or annual/12 in annual mode.
  const liteAnnualTotal = planAnnual(liteAnnual);
  const proAnnualTotal = planAnnual(proAnnual);
  const litePrice =
    billingMode === 'monthly'
      ? formatPrice(planMonthly(liteMonthly))
      : formatPrice(liteAnnualTotal != null ? liteAnnualTotal / 12 : null);
  const proPrice =
    billingMode === 'monthly'
      ? formatPrice(planMonthly(proMonthly))
      : formatPrice(proAnnualTotal != null ? proAnnualTotal / 12 : null);

  // Minutes (per month for plans, one-time for top-ups).
  const liteMinutes = formatMinutes(liteMonthly?.minutes_per_month);
  const starterMinutes = formatMinutes(starterTopup?.minutes);
  const plusMinutes = formatMinutes(plusTopup?.minutes);
  const powerMinutes = formatMinutes(powerTopup?.minutes);

  // Top-up one-time prices.
  const starterPrice = formatPrice(topupAmount(starterTopup));
  const plusPrice = formatPrice(topupAmount(plusTopup));
  const powerPrice = formatPrice(topupAmount(powerTopup));

  // These two keys are not in the message catalog yet; the English default
  // is interpolated here because a defaultValue is returned verbatim.
  const minutesAdded = (minutes: string) =>
    t('pricing.minutesAdded', { minutes, defaultValue: `${minutes} minutes added` });

  return (
    <section ref={sectionRef} id={PRICING_SECTION_ID} className="pricing" aria-busy={catalogLoading}>
      <div className="pricing-container">
        <div className="pricing-header-section">
          <div className="pricing-header">
            <div className="pricing-title-wrapper">
              <h2 className="pricing-title">{t('pricing.title')}</h2>
            </div>
            <p className="pricing-description">{t(isStems ? 'pricing.subtitleStems' : 'pricing.subtitle')}</p>
            {showCanceled && (
              <div className="pricing-canceled-notice" role="status">
                <span>
                  {t('pricing.canceledNotice', {
                    defaultValue: 'Checkout canceled \u2014 you were not charged.',
                  })}
                </span>
                <button
                  type="button"
                  className="pricing-canceled-dismiss"
                  aria-label={t('pricing.dismiss', { defaultValue: 'Dismiss' })}
                  onClick={() => setShowCanceled(false)}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            )}
            {error && (
              <StatusMessage variant="error" style={{ marginTop: '8px' }}>
                {error}
              </StatusMessage>
            )}
          </div>

          <div className="pricing-tabs">
            <button className={`pricing-tab ${activeTab === 'plans' ? 'active' : ''}`} onClick={() => chooseTab('plans')}>
              {t('pricing.tabs.plans')}
            </button>
            <button className={`pricing-tab ${activeTab === 'topups' ? 'active' : ''}`} onClick={() => chooseTab('topups')}>
              {t('pricing.tabs.topups')}
            </button>
            <div className="pricing-tab-indicator" style={{ left: activeTab === 'plans' ? '0' : '50%' }}></div>
          </div>
          {currency === 'cny' && (
            <p className="pricing-pay-note">
              {activeTab === 'plans'
                ? `${t('pricing.payNote.plansCardOnly')}${walletList ? ` ${t('pricing.payNote.walletsOnTopups', { wallets: walletNames(wallets, t, 'or') })}` : ''}`
                : walletList
                  ? t('pricing.payNote.topupsWallets', { wallets: walletList })
                  : t('pricing.payNote.topupsOnce')}
            </p>
          )}
        </div>

        {activeTab === 'plans' && (
          <div className="pricing-toggle-wrapper">
            <div className="pricing-toggle">
              <button className={`toggle-option ${billingMode === 'monthly' ? 'active' : ''}`} onClick={() => setBillingMode('monthly')}>
                {t('pricing.billing.monthly')}
              </button>
              <button className={`toggle-option ${billingMode === 'annual' ? 'active' : ''}`} onClick={() => setBillingMode('annual')}>
                {/* One wrapper: on phones the button is a flex box, which drops the
                    space between loose text and the highlight span. */}
                <span>
                  {t('pricing.billing.annual')} {'\u2022'} <span className="highlight">{t('pricing.billing.threeMonthsFree')}</span>
                </span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'plans' ? (
          <div className="pricing-cards">
            <div className="pricing-card">
              <div className="pricing-card-header">
                <div className="pricing-card-name">
                  <h3 className="plan-name">{t('pricing.plans.free.name')}</h3>
                  <span className="plan-badge">{t('pricing.plans.free.badge')}</span>
                </div>
                <div className="pricing-card-price">
                  <span className="price">{formatPrice(0)}</span>
                  <span className="period">{t('pricing.perMonth')}</span>
                </div>
                <button className="pricing-btn outline" onClick={() => handlePlanClick('free')} disabled={loading === 'free'}>
                  {loading === 'free' ? t('pricing.processing') : t('pricing.plans.free.cta')}
                  <ArrowOutline />
                </button>
              </div>
              <div className="pricing-card-body">
                <p className="plan-subtitle">{t('pricing.plans.free.subtitle')}</p>
                <FeatureList
                  check={<CheckFree />}
                  items={[
                    t('pricing.plans.free.feature1'),
                    t('pricing.plans.free.feature2'),
                    t('pricing.plans.free.feature3', { size: MAX_UPLOAD_MB }),
                    t('pricing.plans.free.feature4'),
                  ]}
                />
              </div>
            </div>

            <div className="pricing-card featured">
              <div className="popular-badge">{t('pricing.popular')}</div>
              <div className="pricing-card-inner">
                <div className="pricing-card-header">
                  <div className="pricing-card-name">
                    <h3 className="plan-name">{t('pricing.plans.lite.name')}</h3>
                    <span className="plan-badge">{t('pricing.plans.lite.badge')}</span>
                  </div>
                  <div className="pricing-card-price">
                    <span className="price">{litePrice || (billingMode === 'monthly' ? '$10' : '$7.5')}</span>
                    <span className="period">{t('pricing.perMonth')}</span>
                  </div>
                  <button className="pricing-btn primary" onClick={() => handlePlanClick('tier2')} disabled={loading === 'tier2'}>
                    {loading === 'tier2' ? t('pricing.processing') : t('pricing.plans.lite.cta')}
                    <ArrowPrimary />
                  </button>
                </div>
                <div className="pricing-card-body">
                  <p className="plan-subtitle">{t('pricing.plans.lite.subtitle')}</p>
                  <FeatureList
                    check={<CheckFeatured />}
                    items={[
                      liteMinutes
                        ? t('pricing.minutesPerMonth', {
                            minutes: liteMinutes,
                            defaultValue: `${liteMinutes} minutes / month`,
                          })
                        : t('pricing.plans.lite.feature1'),
                      t(isStems ? 'pricing.plans.lite.feature2Stems' : 'pricing.plans.lite.feature2'),
                      t('pricing.plans.lite.feature3', { size: MAX_UPLOAD_MB }),
                      t('pricing.plans.lite.feature4'),
                      t('pricing.plans.lite.feature5'),
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="pricing-card">
              <div className="pricing-card-header">
                <div className="pricing-card-name">
                  <h3 className="plan-name">{t('pricing.plans.pro.name')}</h3>
                  <span className="plan-badge">{t('pricing.plans.pro.badge')}</span>
                </div>
                <div className="pricing-card-price">
                  <span className="price">{proPrice || (billingMode === 'monthly' ? '$18' : '$15')}</span>
                  <span className="period">{t('pricing.perUserMonth')}</span>
                </div>
                <button className="pricing-btn outline" onClick={() => handlePlanClick('tier3')} disabled={loading === 'tier3'}>
                  {loading === 'tier3' ? t('pricing.processing') : t('pricing.plans.pro.cta')}
                  <ArrowOutline />
                </button>
              </div>
              <div className="pricing-card-body">
                <p className="plan-subtitle">{t('pricing.plans.pro.subtitle')}</p>
                <FeatureList
                  check={<CheckPro />}
                  items={[
                    t('pricing.plans.pro.feature1'),
                    t('pricing.plans.pro.feature2'),
                    t('pricing.plans.pro.feature3', { size: MAX_UPLOAD_MB }),
                    t('pricing.plans.pro.feature4'),
                  ]}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="pricing-cards">
            <div className="pricing-card">
              <div className="pricing-card-header">
                <div className="pricing-card-name">
                  <h3 className="plan-name">{t('pricing.topups.starter.name')}</h3>
                  <span className="plan-badge">{t('pricing.topups.starter.badge')}</span>
                </div>
                <div className="pricing-card-price">
                  <span className="price">{starterPrice || '$4'}</span>
                  <span className="period">{t('pricing.oneTime')}</span>
                </div>
                <button className="pricing-btn outline" onClick={() => handlePlanClick('topup-30')} disabled={loading === 'topup-30'}>
                  {loading === 'topup-30' ? t('pricing.processing') : t('pricing.topups.starter.cta')}
                  <ArrowOutline />
                </button>
              </div>
              <div className="pricing-card-body">
                <p className="plan-subtitle">{t('pricing.topups.starter.subtitle')}</p>
                <FeatureList
                  check={<CheckFree />}
                  items={[
                    starterMinutes ? minutesAdded(starterMinutes) : t('pricing.topups.starter.feature1'),
                    t('pricing.topups.starter.feature2'),
                    t('pricing.topups.starter.feature3'),
                    t('pricing.topups.starter.feature4'),
                  ]}
                />
              </div>
            </div>

            <div className="pricing-card featured">
              <div className="popular-badge">{t('pricing.popular')}</div>
              <div className="pricing-card-inner">
                <div className="pricing-card-header">
                  <div className="pricing-card-name">
                    <h3 className="plan-name">{t('pricing.topups.plus.name')}</h3>
                    <span className="plan-badge">{t('pricing.topups.plus.badge')}</span>
                  </div>
                  <div className="pricing-card-price">
                    <span className="price">{plusPrice || '$7'}</span>
                    <span className="period">{t('pricing.oneTime')}</span>
                  </div>
                  <button className="pricing-btn primary" onClick={() => handlePlanClick('topup-60')} disabled={loading === 'topup-60'}>
                    {loading === 'topup-60' ? t('pricing.processing') : t('pricing.topups.plus.cta')}
                    <ArrowPrimary />
                  </button>
                </div>
                <div className="pricing-card-body">
                  <p className="plan-subtitle">{t('pricing.topups.plus.subtitle')}</p>
                  <FeatureList
                    check={<CheckFeatured />}
                    items={[
                      plusMinutes ? minutesAdded(plusMinutes) : t('pricing.topups.plus.feature1'),
                      t('pricing.topups.plus.feature2'),
                      t('pricing.topups.plus.feature3'),
                      t('pricing.topups.plus.feature4'),
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="pricing-card">
              <div className="pricing-card-header">
                <div className="pricing-card-name">
                  <h3 className="plan-name">{t('pricing.topups.power.name')}</h3>
                  <span className="plan-badge">{t('pricing.topups.power.badge')}</span>
                </div>
                <div className="pricing-card-price">
                  <span className="price">{powerPrice || '$12'}</span>
                  <span className="period">{t('pricing.oneTime')}</span>
                </div>
                <button className="pricing-btn outline" onClick={() => handlePlanClick('topup-120')} disabled={loading === 'topup-120'}>
                  {loading === 'topup-120' ? t('pricing.processing') : t('pricing.topups.power.cta')}
                  <ArrowOutline />
                </button>
              </div>
              <div className="pricing-card-body">
                <p className="plan-subtitle">{t('pricing.topups.power.subtitle')}</p>
                <FeatureList
                  check={<CheckPro />}
                  items={[
                    powerMinutes ? minutesAdded(powerMinutes) : t('pricing.topups.power.feature1'),
                    t('pricing.topups.power.feature2'),
                    t('pricing.topups.power.feature3'),
                    t('pricing.topups.power.feature4'),
                  ]}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
