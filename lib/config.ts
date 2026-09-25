/**
 * Environment Configuration
 *
 * Browser-visible settings with fallbacks. For local development, put
 * overrides in .env.local. Each value is read as a literal
 * `process.env.NEXT_PUBLIC_*` member so Next inlines it at build time.
 */

const config = {
  // Application Configuration
  appName: process.env.NEXT_PUBLIC_NAME || 'GrooveSheet',
  appUrl: process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',

  // API Configuration. Absolute: the components that use config.apiBaseUrl
  // call the API origin directly (CORS), exactly as the CRA app did.
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'https://api.groovesheet.net',

  // Feature Flags
  enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  enableDebug: process.env.NODE_ENV === 'development',
};

export default config;
