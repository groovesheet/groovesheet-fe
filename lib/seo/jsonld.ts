/**
 * Shared JSON-LD builders. Pages render the result through the JsonLd
 * component; these only shape the objects.
 */
import { buildLocalePath } from '@/lib/locales';
import { SITE_URL } from '@/lib/seo/metadata';

export interface Crumb {
  name: string;
  /** Unprefixed English path, e.g. '/explore'. */
  path: string;
}

/**
 * schema.org BreadcrumbList for the page's position in the site, localized
 * to the URL the visitor is on. Google shows these in place of the raw URL
 * in the result, which turns "groovesheet.net > explore > let-s-get-it-on..."
 * into "GrooveSheet > Explore > Let's Get It On".
 */
export function breadcrumbJsonLd(locale: string, crumbs: Crumb[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => {
      const localized = buildLocalePath(locale, crumb.path);
      return {
        '@type': 'ListItem',
        position: i + 1,
        name: crumb.name,
        item: `${SITE_URL}${localized === '/' ? '/' : localized}`,
      };
    }),
  };
}

export interface FaqEntry {
  question: string;
  answer: string;
}

/** schema.org FAQPage from a list that the page also renders visibly. */
export function faqJsonLd(items: FaqEntry[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.question,
      acceptedAnswer: { '@type': 'Answer', text: it.answer },
    })),
  };
}
