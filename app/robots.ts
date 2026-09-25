import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo/metadata';

/**
 * Robots policy. Replaces public/robots.txt so the list lives next to the
 * routes it describes.
 *
 * Disallow stops the crawl, not the listing: a disallowed URL can still appear
 * in results as a bare link if something points at it. Every path below also
 * carries `robots: noindex` in its page metadata (account, demo, campaign,
 * transcription-history), which is what removes it. The two mechanisms are
 * deliberately redundant. /explore/search is NOT listed: it is noindex,follow,
 * so Google may crawl it to discover tracks without indexing the result pages.
 *
 * Only the index is declared; it points at the pages, library and blog
 * children (lib/seo/sitemap.ts).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/account/',
          '/billing/',
          '/history',
          '/profile',
          '/transcription-history',
          '/signup/',
          '/sso-callback',
          '/service-status',
          '/preview1',
          '/video1',
          '/video2',
          '/api/',
          '/og',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
