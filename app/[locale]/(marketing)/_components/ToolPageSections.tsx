import type { ReactNode } from 'react';
import Footer from '@/components/chrome/Footer';
import type { Locale } from '@/lib/locales';
import Features, { type FeaturesVariant } from './Features';
import Pricing from './Pricing';
import Element, { type ElementProps } from './Element';
import Testimonials from './Testimonials';
import HomeFaq from './HomeFaq';

interface ToolPageSectionsProps {
  locale: Locale;
  variant: FeaturesVariant;
  element: ElementProps;
  /** Rendered above the features band, e.g. the in-flight jobs list. */
  beforeFeatures?: ReactNode;
}

/**
 * Everything below the upload card on /stem-splitter and /midi-converter:
 * the same bands as the landing page, with copy keyed to the tool.
 */
export default function ToolPageSections({ locale, variant, element, beforeFeatures }: ToolPageSectionsProps) {
  return (
    <>
      <div style={{ marginTop: '120px', position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: '-249px',
            left: 0,
            width: '100%',
            height: '249px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, var(--color-tinted-background) 100%)',
            pointerEvents: 'none',
          }}
        />
        {beforeFeatures}
        <Features locale={locale} variant={variant} />
      </div>
      <Pricing />
      <Element {...element} />
      <Testimonials locale={locale} />
      <HomeFaq locale={locale} />
      <Footer />
    </>
  );
}
