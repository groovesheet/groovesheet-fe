import { ShieldCheck, FileArrowDown, MusicNotes } from '@phosphor-icons/react/dist/ssr';
import Header from '@/components/chrome/Header';
import Footer from '@/components/chrome/Footer';
import { staticRouteMetadata } from '@/lib/seo/metadata';
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

// Billing-specific FAQ content (from the Pricing Page design).
const BILLING_FAQ: FaqItem[] = [
  {
    id: 'minute',
    question: 'What does a minute of credit mean?',
    answer:
      '1 minute of audio = 1 minute of credit. A 3-minute song uses 3 minutes \u2014 the same whether you transcribe drums, bass, piano or vocals, and whatever format you export.',
  },
  {
    id: 'deduct',
    question: 'How are minutes deducted from my account?',
    answer:
      'Minutes are deducted from the length of audio you process, rounded up to the nearest second. You can see your remaining balance any time under Billing & Usage in your account.',
  },
  {
    id: 'expire',
    question: 'Do my minutes expire?',
    answer:
      'Plan minutes refresh at the start of each billing cycle and don’t roll over. Top-up minutes never expire \u2014 they stay on your account until you use them.',
  },
  {
    id: 'fail',
    question: 'What happens if a job fails?',
    answer:
      'We retry automatically. If it still fails we don’t deduct any minutes, and you’ll see a failure notice with options to retry or contact support.',
  },
  {
    id: 'add',
    question: 'How do I add more minutes?',
    answer:
      'Buy a one-time top-up from the Top-Ups tab above, or upgrade your plan for a higher monthly allowance. Top-ups apply instantly.',
  },
  {
    id: 'refund',
    question: 'Can I get a refund?',
    answer:
      'Unused top-up minutes may be eligible for a refund. See our Refund Policy for the full details and how to request one.',
  },
  {
    id: 'change',
    question: 'How do I change or cancel my plan?',
    answer:
      'Manage, upgrade, downgrade or cancel anytime from the Stripe billing portal in your account settings. Changes take effect on your next billing date.',
  },
];

export default async function PricingPage(props: LocaleParams) {
  const locale = await routeLocale(props);

  return (
    <div className="pp-canvas">
      <div className="pp-main">
        <Header />

        {/* 1. Page header */}
        <section className="pp-header">
          <p className="pp-kicker">Pricing</p>
          <h1 className="pp-title">Simple, minute-based pricing for working musicians.</h1>
          <p className="pp-subhead">
            1 minute of audio = 1 minute of credit. Start free, upgrade for higher limits and advanced features
            {' \u2014 '}no surprises.
          </p>
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
            Stripe-secure checkout
          </span>
          <span className="pp-trust-item">
            <FileArrowDown size={20} weight="fill" />
            All formats included {'\u2014'} PDF {'·'} MusicXML {'·'} MIDI
          </span>
          <span className="pp-trust-item">
            <MusicNotes size={20} weight="fill" />
            Drums {'·'} Piano {'·'} Bass {'·'} Vocals
          </span>
        </div>

        {/* 5. Billing FAQ */}
        <FaqAccordion
          title="Billing FAQ"
          sections={[{ title: 'Packs & Minutes', items: BILLING_FAQ }]}
          defaultOpenId="minute"
        />

        {/* 6. Final CTA */}
        <section className="pp-cta">
          <div className="pp-cta-inner">
            <h2>Start transcribing free.</h2>
            <p>
              Drag in a track and get clean drum, bass, piano and vocal notation in seconds. No card required to try.
            </p>
            <PricingCtaActions />
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}
