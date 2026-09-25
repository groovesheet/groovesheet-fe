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

const disclaimer = (
  <>
    <span>By uploading a file, you agree to our </span>
    <Link href="/terms">Terms of Service</Link>
  </>
);

export default async function MidiConverterPage(props: LocaleParams) {
  const locale = await routeLocale(props);

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
              <h1 className="hero-title">Convert Any Audio to MIDI in Seconds.</h1>
              <p className="hero-subtitle">
                Upload your track. Get editable, DAW-ready MIDI files and precise sheet music in minutes.
              </p>
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
          titleTop: 'DAW-Ready MIDI,',
          titleBottom: 'On Demand.',
          lede: 'Upload a track, review the transcription, download MIDI and score files.',
        }}
      />
    </div>
  );
}
