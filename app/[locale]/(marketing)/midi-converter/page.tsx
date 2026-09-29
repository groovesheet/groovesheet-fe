import { getTranslations } from 'next-intl/server';
import Header from '@/components/chrome/Header';
import { Link } from '@/lib/navigation';
import { staticRouteMetadata } from '@/lib/seo/metadata';
import HeroBackground from '../_components/HeroBackground';
import MidiConverterUploader from '../_components/upload/MidiConverterUploader';
import ToolPageSections from '../_components/ToolPageSections';
import { routeLocale, type LocaleParams } from '../_components/routeLocale';

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  return staticRouteMetadata('/midi-converter', locale);
}


export default async function MidiConverterPage(props: LocaleParams) {
  const locale = await routeLocale(props);
  const t = await getTranslations({ locale, namespace: 'tools.midiConverter' });
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
      <MidiConverterUploader
        intro={
          <div className="hero-content">
            <div className="hero-text">
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
        variant="midi"
        element={{
          titleTop: t('elementTop'),
          titleBottom: t('elementBottom'),
          lede: t('lede'),
        }}
      />
    </div>
  );
}
