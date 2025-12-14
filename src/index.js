import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ClerkProvider } from '@clerk/clerk-react';

const PUBLISHABLE_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key');
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
      // Configure token behavior for better session management
      // Tokens will auto-refresh when they expire (default is 60 seconds before expiry)
      tokenCache={
        {
          // You can customize token caching here if needed
        }
      }
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
