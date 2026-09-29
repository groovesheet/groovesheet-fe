/**
 * Shared JSON-LD builders. Pages render the result through the JsonLd
 * component; these only shape the objects.
 */
import { buildLocalePath } from '@/lib/locales';
import { SITE_NAME, SITE_URL } from '@/lib/seo/metadata';
import type { BillingCatalog } from '@/lib/types';

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

/**
 * Service + Offer markup from the server-side USD catalog. Visible prices come
 * from the browser (they follow the visitor's currency); the markup declares
 * the list prices in USD. A catalog failure simply omits the offers: the page
 * must not depend on the API.
 *
 * Deliberately `Service`, not `Product`. Google reads Product as a product
 * snippet and flags it for missing `review` / `aggregateRating`, and we have no
 * genuine customer reviews to declare (the Testimonials band is not a review
 * source). Marking up reviews we cannot back is a structured-data spam
 * violation, so the honest fix is the type that matches what this page sells:
 * minutes of a processing service. tests/seo/jsonld.test.ts guards it.
 */
export function pricingJsonLd(catalog: BillingCatalog | null): Record<string, unknown> {
  const offers = (catalog?.plans || [])
    .map((plan) => {
      const price = plan.price_monthly_usd ?? plan.price_monthly;
      if (typeof price !== 'number') return null;
      return {
        '@type': 'Offer',
        name: plan.display_name || plan.id,
        price: price.toFixed(2),
        priceCurrency: 'USD',
        url: `${SITE_URL}/pricing`,
        availability: 'https://schema.org/InStock',
        ...(plan.minutes_per_month ? { description: `${plan.minutes_per_month} minutes of audio per month` } : {}),
      };
    })
    .filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `${SITE_NAME} minutes`,
    serviceType: 'AI music transcription and stem separation',
    description:
      'Minute-based credit for AI music transcription, stem separation and audio-to-MIDI. Preview free, pay only for the audio you process.',
    provider: { '@id': `${SITE_URL}/#organization` },
    brand: { '@type': 'Brand', name: SITE_NAME },
    url: `${SITE_URL}/pricing`,
    ...(offers.length ? { offers } : {}),
  };
}
