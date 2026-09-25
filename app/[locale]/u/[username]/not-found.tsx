import type { Metadata } from 'next';
import CreatorNotFound from './_components/CreatorNotFound';

export const metadata: Metadata = {
  title: 'Creator not found',
  robots: { index: false, follow: false },
};

export default function CreatorNotFoundPage() {
  return <CreatorNotFound />;
}
