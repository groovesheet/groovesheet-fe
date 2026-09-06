import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './i18n';
import App from './App';
import { AuthProvider } from './auth';
import { captureAttribution, captureClickId } from './utils/attribution';
import { initObservability } from './utils/observability';

// Snapshot the campaign query string before React mounts and any router
// navigation drops it. Best-effort and never-throw: a storage failure here
// must not stop the app from rendering.
captureAttribution(window.location.search, document.referrer);

// The Google Ads click id travels in the same query string and disappears just
// as fast, but it is stored separately: it is last-touch, and it has to survive
// all the way to checkout so a payment can be traced back to the ad that
// produced it.
captureClickId(window.location.search);

// Boot PostHog + Clarity. No-ops entirely until their keys are configured.
initObservability();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
