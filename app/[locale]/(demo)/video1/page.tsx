import { setRequestLocale } from 'next-intl/server';
import { Video1 } from '@/components/player';
import { demoMetadata, type DemoRouteProps } from '../_components/demoMetadata';

export function generateMetadata(props: DemoRouteProps) {
  return demoMetadata(props, '/video1', 'Stem Video Frame Preview', 'Live preview of the stem video frame at its native 4K size.');
}

// A full-bleed recording frame, rendered as the whole page as App.js did: no
// Header or Footer. The frame is browser-only and mounts on the client.
export default async function Video1Route({ params }: DemoRouteProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Video1 />;
}
