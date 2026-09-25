/**
 * /sitemap.xml: a sitemap index. The static pages, the library and the blog
 * each have their own child (see lib/seo/sitemap.ts), so one bad upstream
 * (the API, the content app) breaks one child rather than the whole file.
 */
import { renderSitemapIndex } from '@/lib/seo/sitemap';

export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(renderSitemapIndex(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
