/**
 * Environment Configuration
 *
 * This file provides access to environment variables with fallbacks.
 * For local development, create a .env.local file in the root directory.
 */

const config = {
  // Application Configuration
  appName: process.env.REACT_APP_NAME || 'DrumScore',
  appUrl: process.env.REACT_APP_URL || 'http://localhost:3000',

  // API Configuration
  apiBaseUrl: process.env.REACT_APP_API_BASE_URL || 'https://api.groovesheet.net',

  // Feature Flags
  enableAnalytics: process.env.REACT_APP_ENABLE_ANALYTICS === 'true',
  enableDebug: process.env.NODE_ENV === 'development',
};

export default config;
