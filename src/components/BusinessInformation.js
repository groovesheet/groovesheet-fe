import React from 'react';
import Header from './layout/Header';
import Footer from './layout/Footer';
import './LegalPage.css';

function BusinessInformation({ onLoginClick }) {
  return (
    <div className="legal-page">
      <Header onLoginClick={onLoginClick} />
      <main className="legal-container">
        <section className="legal-content">
          <h1 className="legal-title">Business Information</h1>
          <div className="legal-body">
            <div className="legal-section">
              <p className="legal-text">
                GrooveSheet is operated by USEFOOL TECHNOLOGY PRIVATE LIMITED (Hong Kong).
              </p>
              <p className="legal-text">Hong Kong Business Registration No.: 77709205 (Established 2025)</p>
              <p className="legal-text">
                Registered Address: Unit 2A, 17/F, Glenealy Tower, No.1 Glenealy, Central, Hong Kong S.A.R.
              </p>
              <p className="legal-text">Phone: +65 8575 5666</p>
              <p className="legal-text">Email: business@usefool-ai.com</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default BusinessInformation;
