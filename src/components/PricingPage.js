import React, { useState } from 'react';
import { ShieldCheck, FileArrowDown, MusicNotes } from '@phosphor-icons/react';
import Header from './layout/Header';
import Footer from './layout/Footer';
import Pricing from './Pricing';
import Testimonials from './Testimonials';
import { useUser } from '../auth';
import { LocalizedLink } from '../i18n/locale';
import useBillingCatalog, { formatMoney } from '../utils/useBillingCatalog';
import { MAX_UPLOAD_MB } from '../lib/constants';
import usePageMeta from '../hooks/usePageMeta';
import './FAQ.css';
import './PricingPage.css';

// Checkmark used in the comparison table cells.
const CheckIcon = () => (
  <span className="pp-check">
    <svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4.79932 12.1501L10.5593 17.9101L19.1993 7.83008"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

const Dash = () => <span className="pp-dash">–</span>;

// Billing-specific FAQ content (from the Pricing Page design).
const BILLING_FAQ = [
  {
    id: 'minute',
    q: 'What does a minute of credit mean?',
    a: '1 minute of audio = 1 minute of credit. A 3-minute song uses 3 minutes — the same whether you transcribe drums, bass, piano or vocals, and whatever format you export.',
  },
  {
    id: 'deduct',
    q: 'How are minutes deducted from my account?',
    a: 'Minutes are deducted from the length of audio you process, rounded up to the nearest second. You can see your remaining balance any time under Billing & Usage in your account.',
  },
  {
    id: 'expire',
    q: 'Do my minutes expire?',
    a: 'Plan minutes refresh at the start of each billing cycle and don’t roll over. Top-up minutes never expire — they stay on your account until you use them.',
  },
  {
    id: 'fail',
    q: 'What happens if a job fails?',
    a: 'We retry automatically. If it still fails we don’t deduct any minutes, and you’ll see a failure notice with options to retry or contact support.',
  },
  {
    id: 'add',
    q: 'How do I add more minutes?',
    a: 'Buy a one-time top-up from the Top-Ups tab above, or upgrade your plan for a higher monthly allowance. Top-ups apply instantly.',
  },
  {
    id: 'refund',
    q: 'Can I get a refund?',
    a: 'Unused top-up minutes may be eligible for a refund. See our Refund Policy for the full details and how to request one.',
  },
  {
    id: 'change',
    q: 'How do I change or cancel my plan?',
    a: 'Manage, upgrade, downgrade or cancel anytime from the Stripe billing portal in your account settings. Changes take effect on your next billing date.',
  },
];

function PricingPage({ onLoginClick }) {
  usePageMeta(
    'Pricing & Plans',
    'GrooveSheet plans for vocal removal, stem separation, audio to MIDI and '
      + 'audio to sheet music.'
  );

  const { isSignedIn } = useUser();
  const [openFaq, setOpenFaq] = useState('minute');

  // The comparison table quotes "from" prices, which must agree with the plan
  // cards rendered by <Pricing /> below — including the currency, since
  // mainland-China visitors are quoted in yuan. Both read the same cached
  // catalog, so this costs no extra request.
  const { catalog, currency } = useBillingCatalog();
  const planById = (id) => catalog?.plans?.find((p) => p.id === id);
  // "From" = the cheapest way to get the plan, i.e. the annual price per month.
  const monthlyEquivalent = (id, fallback) => {
    const plan = planById(id);
    const annual = plan?.price_annual ?? plan?.price_annual_usd;
    return annual ? formatMoney(annual / 12, currency) : fallback;
  };
  const liteFrom = monthlyEquivalent('lite_annual', '$7.5');
  const proFrom = monthlyEquivalent('pro_annual', '$15');

  // Monthly allowance straight from the live catalog. This row used to be
  // hardcoded and claimed the free tier included 10 minutes a month, which it
  // does not: free grants no credits and only the 10-second preview, so anyone
  // who signed up expecting those minutes found nothing they could do.
  const planMinutes = (id, fallback) => {
    const minutes = planById(id)?.minutes_per_month;
    return typeof minutes === 'number' ? minutes : fallback;
  };
  const freeMinutes = planMinutes('free', 0);
  const liteMinutes = planMinutes('lite_monthly', 120);
  const proMinutes = planMinutes('pro_monthly', 360);

  const toggleFaq = (id) => setOpenFaq((cur) => (cur === id ? null : id));

  return (
    <div className="pp-canvas">
      <div className="pp-main">
        <Header onLoginClick={onLoginClick} />

        {/* 1. Page header */}
        <section className="pp-header">
          <p className="pp-kicker">Pricing</p>
          <h1 className="pp-title">Simple, minute-based pricing for working musicians.</h1>
          <p className="pp-subhead">
            1 minute of audio = 1 minute of credit. Start free, upgrade for higher limits and
            advanced features — no surprises.
          </p>
        </section>

        {/* 2. Pricing cards (shared, API-driven component) */}
        <Pricing onLoginClick={onLoginClick} />

        {/* 3. Comparison table */}
        <section className="pp-compare">
          <div className="pp-compare-wrap">
            <h2 className="pp-compare-h">Compare Plans</h2>
            <p className="pp-compare-sub">
              Every plan includes PDF, MusicXML and MIDI previews. Downloads and priority unlock as
              you go.
            </p>
            <div className="pp-compare-scroll">
              <table className="pp-table">
                <caption>Feature comparison across the Free, Lite and Pro plans.</caption>
                <colgroup>
                  <col className="col-feat" />
                  <col className="col-plan" />
                  <col className="col-plan" />
                  <col className="col-plan" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="th-corner"></th>
                    <th scope="col">
                      <div className="pp-plan-h">
                        <span className="pp-plan-tag">Hobbyist</span>
                        <span className="pp-plan-name">Free</span>
                        <span className="pp-plan-price">{formatMoney(0, currency)} / month</span>
                      </div>
                    </th>
                    <th scope="col" className="is-pop">
                      <div className="pp-plan-h">
                        <span className="pp-plan-tag">Most popular</span>
                        <span className="pp-plan-name">Lite</span>
                        <span className="pp-plan-price">from {liteFrom} / month</span>
                      </div>
                    </th>
                    <th scope="col">
                      <div className="pp-plan-h">
                        <span className="pp-plan-tag">Enterprise</span>
                        <span className="pp-plan-name">Pro</span>
                        <span className="pp-plan-price">from {proFrom} / user</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Minutes / month</th>
                    <td>{freeMinutes > 0 ? freeMinutes : '10-second preview'}</td>
                    <td className="is-pop">{liteMinutes}</td>
                    <td>{proMinutes}</td>
                  </tr>
                  <tr>
                    <th scope="row">Upload size per file</th>
                    <td>{`${MAX_UPLOAD_MB} MB`}</td>
                    <td className="is-pop">{`${MAX_UPLOAD_MB} MB`}</td>
                    <td>{`${MAX_UPLOAD_MB} MB`}</td>
                  </tr>
                  <tr>
                    <th scope="row">
                      Download formats
                      <span className="pp-cell-note">PDF · MusicXML · MIDI</span>
                    </th>
                    <td>Previews only</td>
                    <td className="is-pop">
                      <CheckIcon />
                    </td>
                    <td>
                      <CheckIcon />
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Batch processing</th>
                    <td>
                      <Dash />
                    </td>
                    <td className="is-pop">
                      <CheckIcon />
                    </td>
                    <td>
                      <CheckIcon />
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Queue priority</th>
                    <td>Standard</td>
                    <td className="is-pop">Priority</td>
                    <td>Fast</td>
                  </tr>
                  <tr>
                    <th scope="row">Support</th>
                    <td>Community</td>
                    <td className="is-pop">Priority chat</td>
                    <td>Priority chat</td>
                  </tr>
                  <tr>
                    <th scope="row">Early access to new features</th>
                    <td>
                      <Dash />
                    </td>
                    <td className="is-pop">
                      <Dash />
                    </td>
                    <td>
                      <CheckIcon />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 4. Social proof (shared) + trust row */}
        <Testimonials />
        <div className="pp-trust">
          <span className="pp-trust-item">
            <ShieldCheck size={20} weight="fill" />
            Stripe-secure checkout
          </span>
          <span className="pp-trust-item">
            <FileArrowDown size={20} weight="fill" />
            All formats included — PDF · MusicXML · MIDI
          </span>
          <span className="pp-trust-item">
            <MusicNotes size={20} weight="fill" />
            Drums · Piano · Bass · Vocals
          </span>
        </div>

        {/* 5. Billing FAQ */}
        <section className="faq">
          <div className="faq-container">
            <h2 className="faq-title">Billing FAQ</h2>
            <div className="faq-sections">
              <div className="faq-section">
                <div className="faq-section-header">
                  <div className="faq-section-label">
                    <h3 className="faq-section-title">Packs &amp; Minutes</h3>
                  </div>
                  <div className="faq-questions-column">
                    {BILLING_FAQ.map((item) => {
                      const isOpen = openFaq === item.id;
                      return (
                        <div
                          key={item.id}
                          className={`faq-question-row ${isOpen ? 'open' : ''}`}
                        >
                          <button
                            className="faq-question-button"
                            onClick={() => toggleFaq(item.id)}
                            aria-expanded={isOpen}
                            aria-controls={`${item.id}-answer`}
                          >
                            <div className="faq-question-text">
                              <span>{item.q}</span>
                            </div>
                            <div className={`faq-icon ${isOpen ? 'open' : ''}`} aria-hidden="true">
                              <svg viewBox="0 0 24 24" className="faq-icon-svg">
                                <path
                                  d="M6 10l6 6 6-6"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>
                          </button>
                          <div
                            id={`${item.id}-answer`}
                            className="faq-answer"
                            role="region"
                            aria-hidden={!isOpen}
                          >
                            <p>{item.a}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Final CTA */}
        <section className="pp-cta">
          <div className="pp-cta-inner">
            <h2>Start transcribing free.</h2>
            <p>
              Drag in a track and get clean drum, bass, piano and vocal notation in seconds. No card
              required to try.
            </p>
            <div className="pp-cta-actions">
              {isSignedIn ? (
                <LocalizedLink to="/" className="gs-btn gs-btn-primary">
                  Go to upload
                </LocalizedLink>
              ) : (
                <button type="button" className="gs-btn gs-btn-primary" onClick={onLoginClick}>
                  Get started free
                </button>
              )}
              <LocalizedLink to="/about" className="gs-btn gs-btn-outline">
                Talk to us
              </LocalizedLink>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}

export default PricingPage;
