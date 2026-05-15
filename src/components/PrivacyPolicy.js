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

            <div className="legal-section">
              <h2 className="legal-heading">9. YouTube Integration &amp; Google API Services</h2>
              <p className="legal-text">
                GrooveSheet operates an automated publishing pipeline that uploads stem-separation videos to a YouTube channel we
                own and operate (<a href="https://www.youtube.com/@groovesheet_ai" rel="noopener noreferrer" target="_blank">@groovesheet_ai</a>).
                The pipeline authenticates as the GrooveSheet team account (<em>social@groovesheet.net</em>) using Google OAuth 2.0
                and uses the YouTube Data API v3.
              </p>
              <p className="legal-text">
                Use of GrooveSheet&apos;s YouTube integration is also subject to the{' '}
                <a href="https://www.youtube.com/t/terms" rel="noopener noreferrer" target="_blank">YouTube Terms of Service</a> and the{' '}
                <a href="https://policies.google.com/privacy" rel="noopener noreferrer" target="_blank">Google Privacy Policy</a>.
              </p>
              <p className="legal-text">
                <strong>Scopes used.</strong> The pipeline requests the following OAuth scopes from the operator account that
                authorizes it:
              </p>
              <ul className="legal-list">
                <li>
                  <code>https://www.googleapis.com/auth/youtube.upload</code> &mdash; to publish rendered MP4 videos to the channel
                  we own.
                </li>
                <li>
                  <code>https://www.googleapis.com/auth/youtube.readonly</code> &mdash; to poll the status of freshly uploaded
                  videos so we can detect Google-side processing failures.
                </li>
                <li>
                  <code>https://www.googleapis.com/auth/youtube.force-ssl</code> &mdash; to set and update video metadata after
                  upload (title, description, tags, privacy status, playlist membership).
                </li>
              </ul>
              <p className="legal-text">
                <strong>What data is accessed.</strong> The pipeline only reads and writes metadata for videos owned by the
                authorizing channel (@groovesheet_ai). It does not read data from any other YouTube channel, viewer, or third
                party. End users of GrooveSheet do not authorize this OAuth client; only the team-operated account does.
              </p>
              <p className="legal-text">
                <strong>How the data is used and stored.</strong> The OAuth access and refresh tokens are stored encrypted-at-rest
                on GrooveSheet&apos;s server infrastructure and used solely to operate the upload pipeline. We do not sell,
                transfer, or share this data with third parties; we do not use it for advertising; and we do not use it to train
                machine-learning models. Use of information received from Google APIs adheres to the{' '}
                <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener noreferrer" target="_blank">
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </p>
              <p className="legal-text">
                <strong>Retention.</strong> Tokens are retained only as long as the pipeline is in active operation; revocation or
                rotation invalidates them immediately. Operational logs that incidentally record API call metadata (workflow IDs,
                timestamps, status codes) are retained for up to 90 days for debugging and abuse prevention.
              </p>
              <p className="legal-text">
                <strong>Revoking access.</strong> The team account can revoke GrooveSheet&apos;s YouTube access at any time via{' '}
                <a href="https://myaccount.google.com/permissions" rel="noopener noreferrer" target="_blank">
                  https://myaccount.google.com/permissions
                </a>
                . Revocation takes effect immediately and stops all further uploads.
              </p>
              <p className="legal-text">
                For privacy inquiries related to the YouTube integration, contact business@usefool-ai.com.
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
