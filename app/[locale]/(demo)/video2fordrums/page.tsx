import { setRequestLocale } from 'next-intl/server';
import { Video2Drums } from '@/components/player';
import { demoMetadata, type DemoRouteProps } from '../_components/demoMetadata';

export function generateMetadata(props: DemoRouteProps) {
  return demoMetadata(props, '/video2fordrums', 'Drums Video Frame: Score and Kit', 'Drum transcription video frame, with the score and drum kit in sync.');
}

// A full-bleed recording frame, rendered as the whole page as App.js did: no
// Header or Footer. The frame is browser-only and mounts on the client.
export default async function Video2DrumsRoute({ params }: DemoRouteProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Video2Drums />;
}
