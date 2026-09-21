import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** The Next.js app that serves the blog, the internal portal and their assets. */
const CONTENT_APP = 'https://groovesheet-content-kelin-studio.vercel.app';
const API_ORIGIN = (process.env.API_ORIGIN || 'https://api.groovesheet.net').replace(/\/+$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /**
   * These mirror vercel.json. On Vercel, vercel.json rewrites run at the edge
   * before this app is reached, so in production these are a fallback; in
   * `next dev` and `next start` they are what make /api and the content-app
   * paths work at all (the CRA app used src/setupProxy.js for /api only, so
   * /blog and /internal never worked locally before).
   *
   * Order matters: /api/internal must beat /api. Never rewrite /_next here:
   * that is this app's own asset path, and the content app's assets travel
   * under /content-assets instead.
   */
  async rewrites() {
    return [
      { source: '/api/internal/:path*', destination: `${CONTENT_APP}/api/internal/:path*` },
      { source: '/blog', destination: `${CONTENT_APP}/blog` },
      { source: '/blog/:path*', destination: `${CONTENT_APP}/blog/:path*` },
      { source: '/blog-media/:path*', destination: `${CONTENT_APP}/blog-media/:path*` },
      { source: '/internal', destination: `${CONTENT_APP}/internal` },
      { source: '/internal/:path*', destination: `${CONTENT_APP}/internal/:path*` },
      { source: '/content-assets/:path*', destination: `${CONTENT_APP}/content-assets/:path*` },
      { source: '/blog-sitemap.xml', destination: `${CONTENT_APP}/sitemap.xml` },
      { source: '/api/:path*', destination: `${API_ORIGIN}/:path*` },
      { source: '/sitemap.xml', destination: `${API_ORIGIN}/seo/sitemap.xml` },
    ];
  },
};

export default withNextIntl(nextConfig);
