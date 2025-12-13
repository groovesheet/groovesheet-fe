import React from 'react';
import Header from './layout/Header';
import Footer from './layout/Footer';
import './LegalPage.css';

function RefundPolicy({ onLoginClick }) {
  return (
    <div className="legal-page">
      <Header onLoginClick={onLoginClick} />
      <main className="legal-container">
        <section className="legal-content">
          <h1 className="legal-title">Refunds Policy</h1>
          <div className="legal-body">
            <div className="legal-section">
              <h2 className="legal-heading">1. Overview</h2>
              <p className="legal-text">
                GrooveSheet is a subscription-based service that provides credits each billing cycle. Credits can be used to run music transcription
                and/or separation jobs, measured by the duration (seconds) of audio submitted and/or processed.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">2. Cancellation</h2>
              <p className="legal-text">
                You may cancel your subscription at any time from your account settings. Cancellation stops future renewals and will take effect at the
                end of your current billing period. You will retain access to paid features until the end of that period.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">3. Refunds</h2>
              <p className="legal-text">
                Unless required by applicable law, subscription fees are non-refundable, including for partially used billing periods.
              </p>
              <p className="legal-text">We may provide refunds or credits at our discretion in cases of:</p>
              <ul className="legal-list">
                <li>Duplicate charges</li>
                <li>Billing errors</li>
                <li>Unauthorized payments (subject to investigation)</li>
              </ul>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">4. Credits &amp; Expiry</h2>
              <ul className="legal-list">
                <li>Paid subscription plans receive a monthly allocation of credits that renew each billing cycle.</li>
                <li>Unused monthly credits expire at the end of the billing cycle and do not roll over unless explicitly stated on your plan.</li>
                <li>Free tier credits do not renew. Once used, free tier credits are not replenished.</li>
              </ul>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">5. Failed Jobs / Service Issues</h2>
              <p className="legal-text">
                If a job fails due to a technical issue on our side, we may restore credits for the affected portion once verified.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default RefundPolicy;
