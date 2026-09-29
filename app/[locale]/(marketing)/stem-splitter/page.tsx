import { getTranslations } from 'next-intl/server';
import Header from '@/components/chrome/Header';
import ProcessingJobs from '@/components/ProcessingJobs';
import { Link } from '@/lib/navigation';
import { staticRouteMetadata } from '@/lib/seo/metadata';
import HeroBackground from '../_components/HeroBackground';
import StemSplitterUploader from '../_components/upload/StemSplitterUploader';
import ToolPageSections from '../_components/ToolPageSections';
import { routeLocale, type LocaleParams } from '../_components/routeLocale';

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  return staticRouteMetadata('/stem-splitter', locale);
}


export default async function StemSplitterPage(props: LocaleParams) {
  const locale = await routeLocale(props);
  const t = await getTranslations({ locale, namespace: 'tools.stemSplitter' });
  const tHero = await getTranslations({ locale, namespace: 'hero' });
  const disclaimer = (
    <>
      <span>{tHero('disclaimerPrefix')}</span>
      <Link href="/terms">{tHero('termsOfService')}</Link>
    </>
  );

  return (
    <div
      className="app-container"
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-background)' }}
    >
      <div className="dot-grid"></div>
      <HeroBackground />
      <Header />
      <StemSplitterUploader
        intro={
          <div className="hero-content">
            <div className="hero-text">
              {/* The h1 carries the target phrase verbatim. On the live SERP
                  for "stem splitter" (9,900/mo) every organic result is a tool
                  page naming itself that way, including a Shopify store and a
                  one-page indie tool that both outrank this site: that SERP is
                  won on page relevance, not domain strength. */}
              <h1 className="hero-title">{t('title')}</h1>
              <p className="hero-subtitle">{t('subtitle')}</p>
            </div>
            <div className="hero-disclaimer hero-disclaimer-desktop">{disclaimer}</div>
          </div>
        }
        mobileDisclaimer={<div className="hero-disclaimer hero-disclaimer-mobile">{disclaimer}</div>}
      />
      <ToolPageSections
        locale={locale}
        variant="stems"
        // In-flight jobs, right under the uploader, so leaving this page never loses sight of them.
        beforeFeatures={<ProcessingJobs />}
        element={{
          titleTop: t('elementTop'),
          titleBottom: t('elementBottom'),
          lede: t('lede'),
        }}
      />
    </div>
  );
}
