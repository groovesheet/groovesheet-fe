/* eslint-disable @next/next/no-img-element -- static QR image from public/, same markup as the CRA page */
import { getTranslations } from 'next-intl/server';
import Header from '@/components/chrome/Header';
import Footer from '@/components/chrome/Footer';
import { staticRouteMetadata } from '@/lib/seo/metadata';
import { routeLocale, type LocaleParams } from '../_components/routeLocale';
import HelpSearchFaq from './_components/HelpSearchFaq';
import { CONTACT, faqData, type FaqCategory } from './_components/helpData';
import './_components/HelpSupport.css';

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  return staticRouteMetadata('/help', locale);
}

const ArrowUpRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
);

// FAQPage structured data built from the same list the page renders, in the
// same language, so the markup never claims an answer the visitor cannot see.
function faqJsonLd(faq: FaqCategory[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.flatMap((cat) =>
      cat.items.map((it) => ({
        '@type': 'Question',
        name: it.q,
        acceptedAnswer: { '@type': 'Answer', text: it.a },
      }))
    ),
  };
}

export default async function HelpPage(props: LocaleParams) {
  const locale = await routeLocale(props);
  const t = await getTranslations({ locale, namespace: 'help' });
  const faq = faqData(await getTranslations({ locale, namespace: 'help.faq' }));

  return (
    <div className="help-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faq)).replace(/</g, '\\u003c') }}
      />
      <Header />

      <main className="help-main">
        <HelpSearchFaq
          faq={faq}
          heading={
            <>
              <h1 className="help-hero-title">{t('title')}</h1>
              <p className="help-hero-sub">{t('sub')}</p>
            </>
          }
        />

        {/* Contact channels */}
        <section id="contact" className="help-contact">
          <div className="help-contact-head">
            <h2>{t('contact.heading')}</h2>
            <p>{t('contact.sub')}</p>
          </div>

          <div className="help-contact-grid">
            {/* WeChat featured */}
            <div className="help-wechat">
              <div className="help-wechat-body">
                <div className="help-wechat-top">
                  <span className="help-wechat-badge-icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 3C4.9 3 1.6 5.8 1.6 9.2c0 1.9 1 3.6 2.7 4.8L3.5 16l2.5-1.3c.9.3 1.9.4 3 .4h.5a5.3 5.3 0 0 1-.2-1.5c0-3.2 3.1-5.7 6.9-5.7h.4C16.1 5 12.9 3 9 3Zm-2.4 3.4a.95.95 0 1 1 0 1.9.95.95 0 0 1 0-1.9Zm4.8 0a.95.95 0 1 1 0 1.9.95.95 0 0 1 0-1.9Z" />
                      <path d="M22.4 14.1c0-2.8-2.8-5-6.1-5s-6.1 2.2-6.1 5 2.8 5 6.1 5c.7 0 1.4-.1 2-.3l1.9 1-.5-1.6c1.6-.9 2.7-2.4 2.7-4.1Zm-8-1a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm3.8 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Z" />
                    </svg>
                  </span>
                  <div>
                    <div className="help-wechat-eyebrow">{t('contact.featured')}</div>
                    <h3>{t('contact.wechat')}</h3>
                  </div>
                </div>
                <p className="help-wechat-desc">{t('contact.wechatDesc')}</p>
              </div>
              <div className="help-wechat-qr">
                <img src="/images/wechat-qr.png" alt={t('contact.wechatAlt')} />
              </div>
            </div>

            {/* WhatsApp + Email */}
            <div className="help-contact-stack">
              <a className="help-channel" href={CONTACT.whatsappHref} target="_blank" rel="noreferrer">
                <span className="help-channel-icon help-channel-icon--whatsapp">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2Zm5.8 14.1c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.8-.6-3-1.3-5-4.3-5.1-4.5-.2-.2-1.3-1.7-1.3-3.2s.8-2.3 1.1-2.6c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .7.5l.9 2c.1.2.1.4 0 .5l-.4.6c-.2.2-.4.4-.2.8.2.4.9 1.4 1.9 2.3 1.2 1.1 2.3 1.4 2.6 1.6.3.1.5.1.7-.1l.8-.9c.2-.2.4-.2.6-.1l2 .9c.3.1.5.3.6.4.1.2.1.8-.1 1.5Z" />
                  </svg>
                </span>
                <div className="help-channel-body">
                  <h3>{t('contact.whatsapp')}</h3>
                  <div className="help-channel-line">
                    {CONTACT.whatsappNumber} {'·'} {t('contact.clickToChat')}
                  </div>
                </div>
                <span className="help-channel-arrow">
                  <ArrowUpRight />
                </span>
              </a>

              <a className="help-channel" href={`mailto:${CONTACT.email}`}>
                <span className="help-channel-icon help-channel-icon--email">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
                    <path d="M3 6l9 6.5L21 6" />
                  </svg>
                </span>
                <div className="help-channel-body">
                  <h3>{t('contact.email')}</h3>
                  <div className="help-channel-line">{CONTACT.email}</div>
                </div>
                <span className="help-channel-arrow">
                  <ArrowUpRight />
                </span>
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
