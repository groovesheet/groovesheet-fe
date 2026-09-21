import type { Metadata } from 'next';
import NotFound from '@/components/NotFound';

export const metadata: Metadata = {
  title: 'Track not found',
  robots: { index: false, follow: false },
};

export default function TrackNotFound() {
  return (
    <NotFound
      title="Track not found"
      body="It may have been removed from the library. Let's get you back to the downbeat."
    />
  );
}
