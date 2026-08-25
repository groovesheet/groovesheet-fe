import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './i18n';
import App from './App';
import { AuthProvider } from './auth';
import { captureAttribution } from './utils/attribution';

// Snapshot the campaign query string before React mounts and any router
// navigation drops it. Best-effort and never-throw: a storage failure here
// must not stop the app from rendering.
captureAttribution(window.location.search, document.referrer);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
