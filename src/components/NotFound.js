import React from 'react';
import Header from './layout/Header';
import Footer from './layout/Footer';
import Button from './ui/Button';
import { useLocalizedNavigate, LocalizedLink } from '../i18n/locale';
import './NotFound.css';

function NotFound({ onLoginClick }) {
  const navigate = useLocalizedNavigate();

  return (
    <div className="notfound-page">
      <div className="dot-grid" aria-hidden="true"></div>

      <Header onLoginClick={onLoginClick} />

      <main className="notfound-container">
        <div className="notfound-content">
          {/* Hand-stroked currentColor illustration — same outline language as the
              homepage features and empty states. A note knocked off the staff. */}
          <div className="notfound-ill" aria-hidden="true">
            <svg
              viewBox="0 0 96 96"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 30h44" />
              <path d="M12 42h30" />
              <path d="M64 42h20" />
              <path d="M12 54h72" />
              <path d="M12 66h72" />
              <ellipse cx="60" cy="64" rx="9" ry="7" transform="rotate(-20 60 64)" />
              <path d="M68 62V34l14-5v9" />
            </svg>
          </div>

          <p className="notfound-code">404</p>
          <h1 className="notfound-title">This Page Hit a Wrong Note</h1>
          <p className="notfound-desc">
            The page you're looking for doesn't exist or was moved. Let's get you back in tune.
          </p>

          <div className="notfound-actions">
            <Button variant="primary" size="medium" onClick={() => navigate('/')}>
              Back to Home
            </Button>
            <Button variant="outline" size="medium" onClick={() => navigate('/explore')}>
              Explore Transcriptions
            </Button>
          </div>

          <div className="notfound-links">
            <LocalizedLink to="/pricing">Pricing</LocalizedLink>
            <span className="notfound-links-sep" aria-hidden="true">·</span>
            <LocalizedLink to="/explore">Explore</LocalizedLink>
            <span className="notfound-links-sep" aria-hidden="true">·</span>
            <LocalizedLink to="/help">Search the FAQ</LocalizedLink>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default NotFound;
