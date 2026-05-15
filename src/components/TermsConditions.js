import React from 'react';
import Header from './layout/Header';
import Footer from './layout/Footer';
import './LegalPage.css';

function TermsConditions({ onLoginClick }) {
  return (
    <div className="legal-page">
      <Header onLoginClick={onLoginClick} />
      <main className="legal-container">
        <section className="legal-content">
          <h1 className="legal-title">Terms &amp; Conditions</h1>
          <div className="legal-body">
            <div className="legal-section">
              <h2 className="legal-heading">1. Who we are</h2>
              <p className="legal-text">
                GrooveSheet ("Service") is operated by USEFOOL TECHNOLOGY PRIVATE LIMITED ("we", "us", "our"), a Hong Kong business.
              </p>
              <p className="legal-text">Hong Kong Business Registration No.: 77709205</p>
              <p className="legal-text">Registered Address: Unit 2A, 17/F, Glenealy Tower, No.1 Glenealy, Central, Hong Kong S.A.R</p>
              <p className="legal-text">Contact: business@usefool-ai.com | +65 8575 5666</p>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">2. The Service</h2>
              <p className="legal-text">
                GrooveSheet provides automated music transcription and/or audio separation processing. Output quality may vary based on the
                input audio and other factors.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">3. Accounts</h2>
              <p className="legal-text">
                You are responsible for maintaining the confidentiality of your account credentials and all activities under your account.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">4. Credits</h2>
              <ul className="legal-list">
                <li>Credits represent the allowance to process audio jobs (e.g., measured by seconds of audio input and/or processed output as described in your plan).</li>
                <li>Credits are deducted when you submit jobs.</li>
                <li>Credits renew according to your subscription plan.</li>
                <li>Unused credits expire at the end of the billing cycle unless otherwise stated.</li>
              </ul>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">5. Subscriptions &amp; Billing</h2>
              <p className="legal-text">
                Paid plans are billed in advance on a recurring monthly basis unless otherwise specified. Subscriptions auto-renew until
                cancelled. You authorize us (and our payment providers) to charge your payment method for recurring fees.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">6. Free Tier</h2>
              <p className="legal-text">Free tier users receive a limited amount of credits that do not renew and expire when used up.</p>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">7. Acceptable Use &amp; Content Rights</h2>
              <p className="legal-text">
                You confirm you have the necessary rights and permissions to upload and process any audio or content you submit to GrooveSheet.
              </p>
              <p className="legal-text">
                You must not use the Service to process content that infringes intellectual property rights, violates privacy rights, is unlawful,
                or is otherwise prohibited by applicable law.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">8. Intellectual Property</h2>
              <p className="legal-text">
                We own the Service, software, and related IP. You retain rights to your input content. You grant us a limited license to process your
                content solely to provide the Service.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">9. Service Availability</h2>
              <p className="legal-text">
                We aim for reliable operation but do not guarantee uninterrupted access. We may update, modify, or suspend parts of the Service.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">10. Disclaimers</h2>
              <p className="legal-text">
                The Service is provided "as is" and "as available." Transcription and separation results are generated automatically and may contain errors.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">11. Limitation of Liability</h2>
              <p className="legal-text">
                To the maximum extent permitted by law, we are not liable for indirect, incidental, special, or consequential damages, or for loss of profits, data,
                or goodwill.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">12. Termination</h2>
              <p className="legal-text">We may suspend or terminate accounts for violations of these Terms or misuse of the Service.</p>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">13. YouTube Integration</h2>
              <p className="legal-text">
                GrooveSheet operates an automated publishing pipeline that uploads stem-separation videos to a YouTube channel we
                own (<a href="https://www.youtube.com/@groovesheet_ai" rel="noopener noreferrer" target="_blank">@groovesheet_ai</a>)
                using the YouTube Data API v3. Use of this integration is subject to the{' '}
                <a href="https://www.youtube.com/t/terms" rel="noopener noreferrer" target="_blank">YouTube Terms of Service</a> and the{' '}
                <a href="https://policies.google.com/privacy" rel="noopener noreferrer" target="_blank">Google Privacy Policy</a>.
                See our <a href="/privacy-policy">Privacy Policy</a> for the specific OAuth scopes used and how Google API data is handled.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-heading">14. Changes</h2>
              <p className="legal-text">
                We may update these Terms from time to time. Continued use of the Service after updates means you accept the updated Terms.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default TermsConditions;
