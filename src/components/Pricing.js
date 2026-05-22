import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUser, useAuth } from '../auth';
import { authenticatedFetch } from '../utils/api';
import './Pricing.css';

function Pricing({ onLoginClick }) {
  const { isSignedIn } = useUser();
  const { getToken } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(null);
  const [activeTab, setActiveTab] = useState('plans');
  const [billingMode, setBillingMode] = useState('annual');

  const handlePlanClick = async (plan) => {
    if (!isSignedIn) {
      if (onLoginClick) onLoginClick();
      return;
    }
    setLoading(plan);
    try {
      const response = await authenticatedFetch(
        '/api/user/assign-plan',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan }),
        },
        getToken
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error('Failed to assign plan:', err.detail || response.statusText);
      }
    } catch (error) {
      console.error('Error assigning plan:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="pricing">
      <div className="pricing-container">
        <div className="pricing-header-section">
          <div className="pricing-header">
            <div className="pricing-title-wrapper">
              <h2 className="pricing-title">{t('pricing.title')}</h2>
            </div>
            <p className="pricing-description">{t('pricing.subtitle')}</p>
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
                    <span>{t('pricing.plans.free.feature1')}</span>
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
                    <span className="price">{billingMode === 'monthly' ? '$10' : '$7.5'}</span>
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
                      <span>{t('pricing.plans.lite.feature1')}</span>
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
                  <span className="price">{billingMode === 'monthly' ? '$18' : '$15'}</span>
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
                  <span className="price">$4</span>
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
                    <span>{t('pricing.topups.starter.feature1')}</span>
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
                    <span className="price">$7</span>
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
                      <span>{t('pricing.topups.plus.feature1')}</span>
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
                  <span className="price">$12</span>
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
                    <span>{t('pricing.topups.power.feature1')}</span>
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
