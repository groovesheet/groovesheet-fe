import type { Metadata } from 'next';
import NotFound from '@/components/NotFound';

// Rendered for notFound() anywhere under [locale], including the catch-all
// for unmatched paths, inside the locale layout (providers, fonts, analytics).
// not-found files take no props, so the title cannot vary per locale; the
// design itself is English-only.
export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

export default function LocaleNotFound() {
  return <NotFound />;
}
