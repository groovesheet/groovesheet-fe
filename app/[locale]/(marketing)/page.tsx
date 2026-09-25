import Header from '@/components/chrome/Header';
import Footer from '@/components/chrome/Footer';
import ProcessingJobs from '@/components/ProcessingJobs';
import { Link } from '@/lib/navigation';
import { getT } from '@/lib/i18n-server';
import { staticRouteMetadata } from '@/lib/seo/metadata';
import HeroBackground from './_components/HeroBackground';
import HeroUploader from './_components/upload/HeroUploader';
import FeaturesGradient from './_components/FeaturesGradient';
import Features from './_components/Features';
import Pricing from './_components/Pricing';
import Element from './_components/Element';
import Testimonials from './_components/Testimonials';
import HomeFaq from './_components/HomeFaq';
import { routeLocale, type LocaleParams } from './_components/routeLocale';

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  return staticRouteMetadata('/', locale);
}

/**
 * The landing page. Everything but the upload card, the pricing cards and the
 * in-flight jobs list is server-rendered, so the heading, features,
 * testimonials and FAQ are in the HTML for crawlers and no-JS clients.
 */
export default async function HomePage(props: LocaleParams) {
  const locale = await routeLocale(props);
  const t = await getT(locale);

  const disclaimer = (
    <>
      <span>{t('hero.disclaimerPrefix')}</span>
      <Link href="/terms">{t('hero.termsOfService')}</Link>
    </>
  );

  return (
    <div className="app-container">
      <div className="dot-grid"></div>
      <HeroBackground />
      <Header />
      <HeroUploader
        intro={
          <div className="hero-content">
            <div className="hero-text">
              <h1 className="hero-title">{t('hero.title')}</h1>
              <p className="hero-subtitle">{t('hero.subtitle')}</p>
            </div>
            <div className="hero-disclaimer hero-disclaimer-desktop">{disclaimer}</div>
          </div>
        }
        mobileDisclaimer={<div className="hero-disclaimer hero-disclaimer-mobile">{disclaimer}</div>}
      />
      <FeaturesGradient />
      <div style={{ paddingTop: '120px' }}>
        {/* In-flight jobs, right under the uploader, so leaving this page never loses sight of them. */}
        <ProcessingJobs />
        <Features locale={locale} />
      </div>
      <Pricing />
      {/* High-Accuracy Drum Scores section */}
      <Element />
      <Testimonials locale={locale} />
      <HomeFaq locale={locale} />
      <Footer />
    </div>
  );
}
