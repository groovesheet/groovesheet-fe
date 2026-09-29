import { ShieldCheck, FileArrowDown, MusicNotes } from '@phosphor-icons/react/dist/ssr';
import { getTranslations } from 'next-intl/server';
import Header from '@/components/chrome/Header';
import Footer from '@/components/chrome/Footer';
import { getBillingPlans } from '@/lib/api-server';
import { faqJsonLd } from '@/lib/seo/jsonld';
import { SITE_NAME, SITE_URL, staticRouteMetadata } from '@/lib/seo/metadata';
import type { BillingCatalog } from '@/lib/types';
import JsonLd from '@/app/[locale]/explore/_components/JsonLd';
import Pricing from '../_components/Pricing';
import Testimonials from '../_components/Testimonials';
import FaqAccordion, { type FaqItem } from '../_components/FaqAccordion';
import { routeLocale, type LocaleParams } from '../_components/routeLocale';
import PricingCompare from './_components/PricingCompare';
import PricingCtaActions from './_components/PricingCtaActions';
import './_components/PricingPage.css';

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  return staticRouteMetadata('/pricing', locale);
}

// Billing-specific FAQ content (from the Pricing Page design), in page order.
// The words live in messages/{locale}.json under `pricingPage.faq`.
const BILLING_FAQ_IDS = ['minute', 'deduct', 'expire', 'fail', 'add', 'refund', 'change'] as const;

type PageT = (key: string, values?: Record<string, string | number>) => string;

function billingFaq(t: PageT): FaqItem[] {
  return BILLING_FAQ_IDS.map((id) => ({ id, question: t(`faq.${id}.q`), answer: t(`faq.${id}.a`) }));
}

/**
 * Product + Offer markup from the server-side USD catalog. Visible prices come
 * from the browser (they follow the visitor's currency); the markup declares
 * the list prices in USD, which is what a rich result may show. A catalog
 * failure simply omits the offers: the page must not depend on the API.
 */
function pricingJsonLd(t: PageT, catalog: BillingCatalog | null): Record<string, unknown> {
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
        ...(plan.minutes_per_month ? { description: t('offerMinutes', { minutes: plan.minutes_per_month }) } : {}),
      };
    })
    .filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: t('productName'),
    description: t('productDescription'),
    brand: { '@type': 'Brand', name: SITE_NAME },
    url: `${SITE_URL}/pricing`,
    ...(offers.length ? { offers } : {}),
  };
}

export default async function PricingPage(props: LocaleParams) {
  const locale = await routeLocale(props);
  const t = (await getTranslations({ locale, namespace: 'pricingPage' })) as unknown as PageT;
  const faq = billingFaq(t);
  let catalog: BillingCatalog | null = null;
  try {
    catalog = await getBillingPlans();
  } catch (err) {
    console.error('Pricing page: catalog fetch failed; offers omitted from JSON-LD', err);
  }

  return (
    <div className="pp-canvas">
      <JsonLd data={pricingJsonLd(t, catalog)} />
      <JsonLd data={faqJsonLd(faq.map((f) => ({ question: f.question, answer: f.answer })))} />
      <div className="pp-main">
        <Header />

        {/* 1. Page header */}
        <section className="pp-header">
          <p className="pp-kicker">{t('kicker')}</p>
          <h1 className="pp-title">{t('title')}</h1>
          <p className="pp-subhead">{t('subhead')}</p>
        </section>

        {/* 2. Pricing cards (shared, API-driven component) */}
        <Pricing />

        {/* 3. Comparison table */}
        <PricingCompare />

        {/* 4. Social proof (shared) + trust row */}
        <Testimonials locale={locale} />
        <div className="pp-trust">
          <span className="pp-trust-item">
            <ShieldCheck size={20} weight="fill" />
            {t('trust.checkout')}
          </span>
          <span className="pp-trust-item">
            <FileArrowDown size={20} weight="fill" />
            {t('trust.formats')}
          </span>
          <span className="pp-trust-item">
            <MusicNotes size={20} weight="fill" />
            {/* Notation instruments only: vocals are separated, never transcribed. */}
            {t('trust.instruments')}
          </span>
        </div>

        {/* 5. Billing FAQ */}
        <FaqAccordion
          title={t('faqTitle')}
          sections={[{ title: t('faqSection'), items: faq }]}
          defaultOpenId="minute"
        />

        {/* 6. Final CTA */}
        <section className="pp-cta">
          <div className="pp-cta-inner">
            <h2>{t('cta.title')}</h2>
            <p>{t('cta.body')}</p>
            <PricingCtaActions />
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}
