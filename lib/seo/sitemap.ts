/**
 * Sitemap builders. Pure functions over the route table and locale set, so the
 * XML can be unit-tested without a request.
 *
 * Layout on the wire:
 *   /sitemap.xml            sitemap index (app/sitemap.xml/route.ts)
 *   /sitemaps/pages.xml     every indexable static route x every locale, with
 *                           xhtml:link hreflang alternates (app/sitemaps/pages.xml)
 *   /sitemaps/library.xml   public tracks and creators, from the backend
 *                           (rewrite to /seo/sitemap.xml?scope=library)
 *   /blog-sitemap.xml       the content app's own sitemap (rewrite)
 *
 * Only Next knows the full route tree, the locale set and the hreflang map, so
 * the static routes are emitted here rather than by the backend's Python list,
 * which is how /features and /faq once became two soft 404s in the sitemap.
 * `lastmod` is deliberately absent from the static entries: Google ignores
 * changefreq and priority, and a lastmod that changes on every deploy is one
 * it learns to discount.
 */
import { SUPPORTED_LOCALES, buildLocalePath, type Locale } from '@/lib/locales';
import { LOCALE_HTML_LANG } from '@/lib/locales';
import { ROUTE_META, isEnglishOnly } from '@/lib/seo/routeMeta';
import { SITE_URL } from '@/lib/seo/metadata';

/** Static routes that carry a noindex or exist only as legal boilerplate. */
const SITEMAP_EXCLUDED_PATHS = new Set<string>(['/business-information']);

/** The static routes worth a search result: every ROUTE_META entry not excluded above. */
export function indexableStaticPaths(): string[] {
  return Object.keys(ROUTE_META).filter((p) => !SITEMAP_EXCLUDED_PATHS.has(p));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function absolute(locale: Locale, path: string): string {
  const localized = buildLocalePath(locale, path);
  return `${SITE_URL}${localized === '/' ? '' : localized}` || SITE_URL;
}

export interface SitemapUrl {
  loc: string;
  alternates: { hreflang: string; href: string }[];
}

/**
 * One <url> per (path, locale). Every entry lists all three locales plus
 * x-default (the English URL) so Google sees the same cluster from each side,
 * which is what hreflang requires to be honoured.
 */
export function staticSitemapUrls(paths: string[] = indexableStaticPaths()): SitemapUrl[] {
  const urls: SitemapUrl[] = [];
  for (const path of paths) {
    // One entry, no alternates, for a page that is English at every URL: its
    // locale copies canonicalize to this one, and listing them would submit
    // three URLs for one document (see ENGLISH_ONLY_PATHS).
    if (isEnglishOnly(path)) {
      urls.push({ loc: absolute('en', path), alternates: [] });
      continue;
    }
    const alternates = [
      { hreflang: 'x-default', href: absolute('en', path) },
      ...SUPPORTED_LOCALES.map((l) => ({ hreflang: LOCALE_HTML_LANG[l], href: absolute(l, path) })),
    ];
    for (const locale of SUPPORTED_LOCALES) {
      urls.push({ loc: absolute(locale, path), alternates });
    }
  }
  return urls;
}

export function renderUrlset(urls: SitemapUrl[]): string {
  const body = urls
    .map((u) => {
      const links = u.alternates
        .map((a) => `<xhtml:link rel="alternate" hreflang="${escapeXml(a.hreflang)}" href="${escapeXml(a.href)}"/>`)
        .join('');
      return `<url><loc>${escapeXml(u.loc)}</loc>${links}</url>`;
    })
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' +
    body +
    '</urlset>'
  );
}

/** The child sitemaps the index points at, as absolute URLs. */
export const SITEMAP_CHILDREN = ['/sitemaps/pages.xml', '/sitemaps/library.xml', '/blog-sitemap.xml'] as const;

export function renderSitemapIndex(children: readonly string[] = SITEMAP_CHILDREN): string {
  const body = children.map((c) => `<sitemap><loc>${escapeXml(`${SITE_URL}${c}`)}</loc></sitemap>`).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    body +
    '</sitemapindex>'
  );
}
