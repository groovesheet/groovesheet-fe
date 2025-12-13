import React from 'react';
import Header from './layout/Header';
import Footer from './layout/Footer';
import './LegalPage.css';

function PrivacyPolicy({ onLoginClick }) {
  return (
    <div className="legal-page">
      <Header onLoginClick={onLoginClick} />
      <main className="legal-container">
        <section className="legal-content">
          <h1 className="legal-title">Privacy Policy</h1>
          <div className="legal-body">
            <div className="legal-section">
              <h2 className="legal-heading">1. What we collect</h2>
              <p className="legal-text">
                We collect information you provide (e.g., name, email, account details), subscription and billing status
                (payment details are handled by our payment providers), and technical data (device and usage logs).
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">2. Audio &amp; Processing Data</h2>
              <p className="legal-text">When you upload audio, we process it to generate results (e.g., transcription/separation output). We may store:</p>
              <ul className="legal-list">
                <li>Uploaded audio files</li>
                <li>Job metadata (duration, timestamps)</li>
                <li>Generated outputs</li>
              </ul>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">3. How we use data</h2>
              <p className="legal-text">
                To provide and improve the Service, operate billing, prevent abuse, provide support, and comply with legal obligations.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">4. Sharing</h2>
              <p className="legal-text">
                We share data with service providers necessary to run GrooveSheet, such as hosting/storage providers and payment providers.
                We do not sell your personal data.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">5. Data retention</h2>
              <p className="legal-text">
                We retain data as long as needed to provide the Service and for legitimate business/legal purposes. You may request deletion
                subject to legal and operational constraints.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">6. International transfers</h2>
              <p className="legal-text">Your data may be processed in countries where our providers operate (e.g., Singapore and other regions).</p>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">7. Security</h2>
              <p className="legal-text">
                We use reasonable technical and organizational measures to protect data, but no system is 100% secure.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">8. Your choices</h2>
              <p className="legal-text">
                You can update account information and request access or deletion by contacting business@usefool-ai.com.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default PrivacyPolicy;
