/**
 * /sitemaps/pages.xml: every indexable static route in every locale, with the
 * hreflang cluster on each entry. Built from lib/seo/routeMeta.ts, the same
 * table generateMetadata reads, so a route cannot be titled but unlisted, or
 * listed but 404.
 */
import { renderUrlset, staticSitemapUrls } from '@/lib/seo/sitemap';

export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(renderUrlset(staticSitemapUrls()), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
