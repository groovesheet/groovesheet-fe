import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUser, useAuth } from '../auth';
import { fetchBillingPlans, createCheckoutSession } from '../utils/api';
import StatusMessage from './ui/StatusMessage';
import './Pricing.css';

/**
 * Format a USD amount the way the static copy did ($0, $10, $7.5) — drop a
 * trailing ".0" but keep meaningful cents. Returns null for non-numbers so the
 * caller can fall back to its static text.
 */
const formatPrice = (value) => {
  if (value == null || Number.isNaN(Number(value))) return null;
  const num = Number(value);
  // Up to 2 decimals, but strip insignificant trailing zeros (10.00 -> 10, 7.50 -> 7.5).
  const trimmed = parseFloat(num.toFixed(2));
  return `$${trimmed}`;
};

/**
 * Format a minute count as a clean integer when whole (120 -> "120"), else keep
 * one decimal. Returns null for non-numbers so the caller can fall back.
 */
const formatMinutes = (value) => {
  if (value == null || Number.isNaN(Number(value))) return null;
  const num = Number(value);
  return Number.isInteger(num) ? String(num) : String(parseFloat(num.toFixed(1)));
};

function Pricing({ onLoginClick }) {
  const { isSignedIn } = useUser();
  const { getToken, signOut } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('plans');
  const [billingMode, setBillingMode] = useState('annual');

  // Public pricing catalog from the backend (single source of truth for numbers).
  const [catalog, setCatalog] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // "Checkout canceled" notice — shown when Stripe returns the user to /pricing?canceled.
  const [showCanceled, setShowCanceled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchBillingPlans('/api');
        if (!cancelled) setCatalog(data);
      } catch (err) {
        // Never block the page — fall back to the static copy already in the markup.
        console.warn('Failed to load billing plans; using static fallback values.', err);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('canceled')) {
      setShowCanceled(true);
    }
  }, []);

  // Index catalog entries by id for easy lookup. Undefined until the API resolves.
  const planById = (id) => catalog?.plans?.find((p) => p.id === id);
  const topupById = (id) => catalog?.topups?.find((tp) => tp.id === id);

  /**
   * Resolve a UI plan slug + billing mode to the backend plan key.
   * The 'free' tier never hits checkout (no payment).
   */
  const resolvePlanKey = (plan) => {
    if (plan === 'tier2') return billingMode === 'annual' ? 'tier2_annual' : 'tier2';
    if (plan === 'tier3') return billingMode === 'annual' ? 'tier3_annual' : 'tier3';
    return plan; // topup-30 / topup-60 / topup-120
  };

  const handlePlanClick = async (plan) => {
    setError(null);

    if (!isSignedIn) {
      if (onLoginClick) onLoginClick();
      return;
    }

    // Free tier has no payment; nothing to do here (handled elsewhere on signup).
    if (plan === 'free') return;

    setLoading(plan);
    try {
      const planKey = resolvePlanKey(plan);
      const data = await createCheckoutSession('/api', planKey, getToken, signOut);

      if (!data?.url) {
        setError('Checkout session was created but no redirect URL was returned.');
        return;
      }

      // Hand off to Stripe-hosted Checkout
      window.location.assign(data.url);
    } catch (err) {
      console.error('Error creating checkout session:', err);
      setError(err.message || 'Unexpected error starting checkout');
    } finally {
      setLoading(null);
    }
  };

  // --- Derived display values (API-driven, with graceful static fallbacks) ---
  const free = planById('free');
  const liteMonthly = planById('lite_monthly');
  const liteAnnual = planById('lite_annual');
  const proMonthly = planById('pro_monthly');
  const proAnnual = planById('pro_annual');
  const starterTopup = topupById('starter');
  const plusTopup = topupById('plus');
  const powerTopup = topupById('power');

  // Per-month price for Lite: monthly plan's monthly price, or annual/12 in annual mode.
  const litePrice =
    billingMode === 'monthly'
      ? formatPrice(liteMonthly?.price_monthly_usd)
      : formatPrice(liteAnnual?.price_annual_usd != null ? liteAnnual.price_annual_usd / 12 : null);
  const proPrice =
    billingMode === 'monthly'
      ? formatPrice(proMonthly?.price_monthly_usd)
      : formatPrice(proAnnual?.price_annual_usd != null ? proAnnual.price_annual_usd / 12 : null);

  // Minutes (per month for plans, one-time for top-ups).
  const freeMinutes = formatMinutes(free?.minutes_per_month);
  const liteMinutes = formatMinutes(liteMonthly?.minutes_per_month);
  const starterMinutes = formatMinutes(starterTopup?.minutes);
  const plusMinutes = formatMinutes(plusTopup?.minutes);
  const powerMinutes = formatMinutes(powerTopup?.minutes);

  // Top-up one-time prices.
  const starterPrice = formatPrice(starterTopup?.price_usd);
  const plusPrice = formatPrice(plusTopup?.price_usd);
  const powerPrice = formatPrice(powerTopup?.price_usd);

  return (
    <section className="pricing" aria-busy={catalogLoading}>
      <div className="pricing-container">
        <div className="pricing-header-section">
          <div className="pricing-header">
            <div className="pricing-title-wrapper">
              <h2 className="pricing-title">{t('pricing.title')}</h2>
            </div>
            <p className="pricing-description">{t('pricing.subtitle')}</p>
            {showCanceled && (
              <div className="pricing-canceled-notice" role="status">
                <span>
                  {t('pricing.canceledNotice', {
                    defaultValue: 'Checkout canceled — you were not charged.',
                  })}
                </span>
                <button
                  type="button"
                  className="pricing-canceled-dismiss"
                  aria-label={t('pricing.dismiss', { defaultValue: 'Dismiss' })}
                  onClick={() => setShowCanceled(false)}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
            <button className={`pricing-tab ${activeTab === 'plans' ? 'active' : ''}`} onClick={() => setActiveTab('plans')}>{t('pricing.tabs.plans')}</button>
            <button className={`pricing-tab ${activeTab === 'topups' ? 'active' : ''}`} onClick={() => setActiveTab('topups')}>{t('pricing.tabs.topups')}</button>
            <div className="pricing-tab-indicator" style={{ left: activeTab === 'plans' ? '0' : '50%' }}></div>
          </div>
        </div>

        {activeTab === 'plans' && (
          <div className="pricing-toggle-wrapper">
            <div className="pricing-toggle">
              <button className={`toggle-option ${billingMode === 'monthly' ? 'active' : ''}`} onClick={() => setBillingMode('monthly')}>{t('pricing.billing.monthly')}</button>
              <button className={`toggle-option ${billingMode === 'annual' ? 'active' : ''}`} onClick={() => setBillingMode('annual')}>
                {t('pricing.billing.annual')} • <span className="highlight">{t('pricing.billing.threeMonthsFree')}</span>
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
                  <span className="price">$0</span>
                  <span className="period">{t('pricing.perMonth')}</span>
                </div>
                <button className="pricing-btn outline" onClick={() => handlePlanClick('free')} disabled={loading === 'free'}>
                  {loading === 'free' ? t('pricing.processing') : t('pricing.plans.free.cta')}
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6.0835 3.27991L10.4585 7.65491L6.0835 12.0299" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <div className="pricing-card-body">
                <p className="plan-subtitle">{t('pricing.plans.free.subtitle')}</p>
                <ul className="plan-features">
                  <li className="feature-item">
                    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.18799 8.92992L5.24999 11.9929L12.25 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>
                      {freeMinutes
                        ? t('pricing.minutesPerMonth', {
                            minutes: freeMinutes,
                            defaultValue: '{{minutes}} minutes / month',
                          })
                        : t('pricing.plans.free.feature1')}
                    </span>
                  </li>
                  <li className="feature-item">
                    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.18799 8.92992L5.24999 11.9929L12.25 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{t('pricing.plans.free.feature2')}</span>
                  </li>
                  <li className="feature-item">
                    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.18799 8.92992L5.24999 11.9929L12.25 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{t('pricing.plans.free.feature3')}</span>
                  </li>
                  <li className="feature-item">
                    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.18799 8.92992L5.24999 11.9929L12.25 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{t('pricing.plans.free.feature4')}</span>
                  </li>
                </ul>
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
                    <span className="price">
                      {litePrice || (billingMode === 'monthly' ? '$10' : '$7.5')}
                    </span>
                    <span className="period">{t('pricing.perMonth')}</span>
                  </div>
                  <button className="pricing-btn primary" onClick={() => handlePlanClick('tier2')} disabled={loading === 'tier2'}>
                    {loading === 'tier2' ? t('pricing.processing') : t('pricing.plans.lite.cta')}
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5.75 2.88501L10.125 7.26001L5.75 11.635" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
                <div className="pricing-card-body">
                  <p className="plan-subtitle">{t('pricing.plans.lite.subtitle')}</p>
                  <ul className="plan-features">
                    <li className="feature-item">
                      <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.85474 8.53502L5.91674 11.598L12.9167 4.59802" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>
                        {liteMinutes
                          ? t('pricing.minutesPerMonth', {
                              minutes: liteMinutes,
                              defaultValue: '{{minutes}} minutes / month',
                            })
                          : t('pricing.plans.lite.feature1')}
                      </span>
                    </li>
                    <li className="feature-item">
                      <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.85474 8.53502L5.91674 11.598L12.9167 4.59802" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>{t('pricing.plans.lite.feature2')}</span>
                    </li>
                    <li className="feature-item">
                      <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.85474 8.53502L5.91674 11.598L12.9167 4.59802" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>{t('pricing.plans.lite.feature3')}</span>
                    </li>
                    <li className="feature-item">
                      <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.85474 8.53502L5.91674 11.598L12.9167 4.59802" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>{t('pricing.plans.lite.feature4')}</span>
                    </li>
                    <li className="feature-item">
                      <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.85474 8.53502L5.91674 11.598L12.9167 4.59802" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>{t('pricing.plans.lite.feature5')}</span>
                    </li>
                  </ul>
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
                  <span className="price">
                    {proPrice || (billingMode === 'monthly' ? '$18' : '$15')}
                  </span>
                  <span className="period">{t('pricing.perUserMonth')}</span>
                </div>
                <button className="pricing-btn outline" onClick={() => handlePlanClick('tier3')} disabled={loading === 'tier3'}>
                  {loading === 'tier3' ? t('pricing.processing') : t('pricing.plans.pro.cta')}
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6.0835 3.27991L10.4585 7.65491L6.0835 12.0299" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <div className="pricing-card-body">
                <p className="plan-subtitle">{t('pricing.plans.pro.subtitle')}</p>
                <ul className="plan-features">
                  <li className="feature-item">
                    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.52148 8.92992L5.58348 11.9929L12.5835 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{t('pricing.plans.pro.feature1')}</span>
                  </li>
                  <li className="feature-item">
                    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.52148 8.92992L5.58348 11.9929L12.5835 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{t('pricing.plans.pro.feature2')}</span>
                  </li>
                  <li className="feature-item">
                    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.52148 8.92992L5.58348 11.9929L12.5835 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{t('pricing.plans.pro.feature3')}</span>
                  </li>
                  <li className="feature-item">
                    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.52148 8.92992L5.58348 11.9929L12.5835 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{t('pricing.plans.pro.feature4')}</span>
                  </li>
                </ul>
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
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6.0835 3.27991L10.4585 7.65491L6.0835 12.0299" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <div className="pricing-card-body">
                <p className="plan-subtitle">{t('pricing.topups.starter.subtitle')}</p>
                <ul className="plan-features">
                  <li className="feature-item">
                    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.18799 8.92992L5.24999 11.9929L12.25 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>
                      {starterMinutes
                        ? t('pricing.minutesAdded', {
                            minutes: starterMinutes,
                            defaultValue: '{{minutes}} minutes added',
                          })
                        : t('pricing.topups.starter.feature1')}
                    </span>
                  </li>
                  <li className="feature-item">
                    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.18799 8.92992L5.24999 11.9929L12.25 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{t('pricing.topups.starter.feature2')}</span>
                  </li>
                  <li className="feature-item">
                    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.18799 8.92992L5.24999 11.9929L12.25 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{t('pricing.topups.starter.feature3')}</span>
                  </li>
                  <li className="feature-item">
                    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.18799 8.92992L5.24999 11.9929L12.25 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{t('pricing.topups.starter.feature4')}</span>
                  </li>
                </ul>
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
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5.75 2.88501L10.125 7.26001L5.75 11.635" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
                <div className="pricing-card-body">
                  <p className="plan-subtitle">{t('pricing.topups.plus.subtitle')}</p>
                  <ul className="plan-features">
                    <li className="feature-item">
                      <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.85474 8.53502L5.91674 11.598L12.9167 4.59802" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>
                        {plusMinutes
                          ? t('pricing.minutesAdded', {
                              minutes: plusMinutes,
                              defaultValue: '{{minutes}} minutes added',
                            })
                          : t('pricing.topups.plus.feature1')}
                      </span>
                    </li>
                    <li className="feature-item">
                      <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.85474 8.53502L5.91674 11.598L12.9167 4.59802" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>{t('pricing.topups.plus.feature2')}</span>
                    </li>
                    <li className="feature-item">
                      <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.85474 8.53502L5.91674 11.598L12.9167 4.59802" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>{t('pricing.topups.plus.feature3')}</span>
                    </li>
                    <li className="feature-item">
                      <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.85474 8.53502L5.91674 11.598L12.9167 4.59802" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>{t('pricing.topups.plus.feature4')}</span>
                    </li>
                  </ul>
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
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6.0835 3.27991L10.4585 7.65491L6.0835 12.0299" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <div className="pricing-card-body">
                <p className="plan-subtitle">{t('pricing.topups.power.subtitle')}</p>
                <ul className="plan-features">
                  <li className="feature-item">
                    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.52148 8.92992L5.58348 11.9929L12.5835 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>
                      {powerMinutes
                        ? t('pricing.minutesAdded', {
                            minutes: powerMinutes,
                            defaultValue: '{{minutes}} minutes added',
                          })
                        : t('pricing.topups.power.feature1')}
                    </span>
                  </li>
                  <li className="feature-item">
                    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.52148 8.92992L5.58348 11.9929L12.5835 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{t('pricing.topups.power.feature2')}</span>
                  </li>
                  <li className="feature-item">
                    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.52148 8.92992L5.58348 11.9929L12.5835 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{t('pricing.topups.power.feature3')}</span>
                  </li>
                  <li className="feature-item">
                    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.52148 8.92992L5.58348 11.9929L12.5835 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{t('pricing.topups.power.feature4')}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default Pricing;
