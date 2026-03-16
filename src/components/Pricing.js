import React, { useState } from 'react';
import './Pricing.css';

function Pricing() {
  const [activeTab, setActiveTab] = useState('plans');
  const [billingMode, setBillingMode] = useState('annual');

  return (
    <section className="pricing">
      <div className="pricing-container">
        <div className="pricing-header-section">
          <div className="pricing-header">
            <div className="pricing-title-wrapper">
              <h2 className="pricing-title">Affordable Plans For Everyone.</h2>
            </div>
            <p className="pricing-description">
              Try it free today. Upgrade for higher limits and advanced features without breaking the bank.
            </p>
          </div>

          <div className="pricing-tabs">
            <button className={`pricing-tab ${activeTab === 'plans' ? 'active' : ''}`} onClick={() => setActiveTab('plans')}>Plans</button>
            <button className={`pricing-tab ${activeTab === 'topups' ? 'active' : ''}`} onClick={() => setActiveTab('topups')}>Top-Ups</button>
            <div className="pricing-tab-indicator" style={{ left: activeTab === 'plans' ? '0' : '50%' }}></div>
          </div>
        </div>

        {activeTab === 'plans' && (
          <div className="pricing-toggle-wrapper">
            <div className="pricing-toggle">
              <button className={`toggle-option ${billingMode === 'monthly' ? 'active' : ''}`} onClick={() => setBillingMode('monthly')}>Monthly</button>
              <button className={`toggle-option ${billingMode === 'annual' ? 'active' : ''}`} onClick={() => setBillingMode('annual')}>
                Annually • <span className="highlight">3 Months Free</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'plans' ? (
          <div className="pricing-cards">
            <div className="pricing-card">
              <div className="pricing-card-header">
                <div className="pricing-card-name">
                  <h3 className="plan-name">Free</h3>
                  <span className="plan-badge">HOBBYIST</span>
                </div>
                <div className="pricing-card-price">
                  <span className="price">$0</span>
                  <span className="period">/month</span>
                </div>
                <button className="pricing-btn outline">
                  Get Free
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6.0835 3.27991L10.4585 7.65491L6.0835 12.0299" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <div className="pricing-card-body">
                <p className="plan-subtitle">For individuals</p>
                <ul className="plan-features">
                  <li className="feature-item">
                    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.18799 8.92992L5.24999 11.9929L12.25 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>10 minutes / month</span>
                  </li>
                  <li className="feature-item">
                    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.18799 8.92992L5.24999 11.9929L12.25 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Free result previews</span>
                  </li>
                  <li className="feature-item">
                    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.18799 8.92992L5.24999 11.9929L12.25 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>100 MB upload/file</span>
                  </li>
                  <li className="feature-item">
                    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.18799 8.92992L5.24999 11.9929L12.25 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Standard queue</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pricing-card featured">
              <div className="popular-badge">MOST POPULAR</div>
              <div className="pricing-card-inner">
                <div className="pricing-card-header">
                  <div className="pricing-card-name">
                    <h3 className="plan-name">Lite</h3>
                    <span className="plan-badge">PROFESSIONAL</span>
                  </div>
                  <div className="pricing-card-price">
                    <span className="price">{billingMode === 'monthly' ? '$10' : '$7.5'}</span>
                    <span className="period">/month</span>
                  </div>
                  <button className="pricing-btn primary">
                    Subscribe
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5.75 2.88501L10.125 7.26001L5.75 11.635" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
                <div className="pricing-card-body">
                  <p className="plan-subtitle">Best for small teams</p>
                  <ul className="plan-features">
                    <li className="feature-item">
                      <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.85474 8.53502L5.91674 11.598L12.9167 4.59802" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>120 minutes / month</span>
                    </li>
                    <li className="feature-item">
                      <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.85474 8.53502L5.91674 11.598L12.9167 4.59802" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Result downloads (PDF, MusicXML, MIDI)</span>
                    </li>
                    <li className="feature-item">
                      <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.85474 8.53502L5.91674 11.598L12.9167 4.59802" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>500 MB upload/file</span>
                    </li>
                    <li className="feature-item">
                      <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.85474 8.53502L5.91674 11.598L12.9167 4.59802" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Batch processing</span>
                    </li>
                    <li className="feature-item">
                      <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.85474 8.53502L5.91674 11.598L12.9167 4.59802" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Priority support with chat</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="pricing-card">
              <div className="pricing-card-header">
                <div className="pricing-card-name">
                  <h3 className="plan-name">Pro</h3>
                  <span className="plan-badge">ENTERPRISE</span>
                </div>
                <div className="pricing-card-price">
                  <span className="price">{billingMode === 'monthly' ? '$18' : '$15'}</span>
                  <span className="period">user/month</span>
                </div>
                <button className="pricing-btn outline">
                  Subscribe
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6.0835 3.27991L10.4585 7.65491L6.0835 12.0299" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <div className="pricing-card-body">
                <p className="plan-subtitle">Designed for companies</p>
                <ul className="plan-features">
                  <li className="feature-item">
                    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.52148 8.92992L5.58348 11.9929L12.5835 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Everything in Lite</span>
                  </li>
                  <li className="feature-item">
                    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.52148 8.92992L5.58348 11.9929L12.5835 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Fast queue</span>
                  </li>
                  <li className="feature-item">
                    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.52148 8.92992L5.58348 11.9929L12.5835 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>1 GB upload/file</span>
                  </li>
                  <li className="feature-item">
                    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.52148 8.92992L5.58348 11.9929L12.5835 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Early access to new features</span>
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
                  <h3 className="plan-name">Starter</h3>
                  <span className="plan-badge">STARTER</span>
                </div>
                <div className="pricing-card-price">
                  <span className="price">$4</span>
                  <span className="period">one-time</span>
                </div>
                <button className="pricing-btn outline">
                  Buy
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6.0835 3.27991L10.4585 7.65491L6.0835 12.0299" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <div className="pricing-card-body">
                <p className="plan-subtitle">Quick boost</p>
                <ul className="plan-features">
                  <li className="feature-item">
                    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.18799 8.92992L5.24999 11.9929L12.25 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>30 minutes added</span>
                  </li>
                  <li className="feature-item">
                    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.18799 8.92992L5.24999 11.9929L12.25 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Never expire</span>
                  </li>
                  <li className="feature-item">
                    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.18799 8.92992L5.24999 11.9929L12.25 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>All formats included</span>
                  </li>
                  <li className="feature-item">
                    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.18799 8.92992L5.24999 11.9929L12.25 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Standard queue</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pricing-card featured">
              <div className="popular-badge">MOST POPULAR</div>
              <div className="pricing-card-inner">
                <div className="pricing-card-header">
                  <div className="pricing-card-name">
                    <h3 className="plan-name">Plus</h3>
                    <span className="plan-badge">PLUS</span>
                  </div>
                  <div className="pricing-card-price">
                    <span className="price">$7</span>
                    <span className="period">one-time</span>
                  </div>
                  <button className="pricing-btn primary">
                    Buy
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5.75 2.88501L10.125 7.26001L5.75 11.635" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
                <div className="pricing-card-body">
                  <p className="plan-subtitle">Best value</p>
                  <ul className="plan-features">
                    <li className="feature-item">
                      <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.85474 8.53502L5.91674 11.598L12.9167 4.59802" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>60 minutes added</span>
                    </li>
                    <li className="feature-item">
                      <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.85474 8.53502L5.91674 11.598L12.9167 4.59802" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Never expire</span>
                    </li>
                    <li className="feature-item">
                      <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.85474 8.53502L5.91674 11.598L12.9167 4.59802" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>All formats included</span>
                    </li>
                    <li className="feature-item">
                      <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.85474 8.53502L5.91674 11.598L12.9167 4.59802" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Priority queue</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="pricing-card">
              <div className="pricing-card-header">
                <div className="pricing-card-name">
                  <h3 className="plan-name">Power</h3>
                  <span className="plan-badge">POWER</span>
                </div>
                <div className="pricing-card-price">
                  <span className="price">$12</span>
                  <span className="period">one-time</span>
                </div>
                <button className="pricing-btn outline">
                  Buy
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6.0835 3.27991L10.4585 7.65491L6.0835 12.0299" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <div className="pricing-card-body">
                <p className="plan-subtitle">Maximum boost</p>
                <ul className="plan-features">
                  <li className="feature-item">
                    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.52148 8.92992L5.58348 11.9929L12.5835 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>120 minutes added</span>
                  </li>
                  <li className="feature-item">
                    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.52148 8.92992L5.58348 11.9929L12.5835 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Never expire</span>
                  </li>
                  <li className="feature-item">
                    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.52148 8.92992L5.58348 11.9929L12.5835 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>All formats included</span>
                  </li>
                  <li className="feature-item">
                    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.52148 8.92992L5.58348 11.9929L12.5835 4.99292" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Priority queue</span>
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
