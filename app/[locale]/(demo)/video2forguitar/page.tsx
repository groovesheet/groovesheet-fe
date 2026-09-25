import { setRequestLocale } from 'next-intl/server';
import { Video2Guitar } from '@/components/player';
import { demoMetadata, type DemoRouteProps } from '../_components/demoMetadata';

export function generateMetadata(props: DemoRouteProps) {
  return demoMetadata(props, '/video2forguitar', 'Guitar Video Frame: Score and Fretboard', 'Guitar transcription video frame, with the score and fretboard in sync.');
}

// A full-bleed recording frame, rendered as the whole page as App.js did: no
// Header or Footer. The frame is browser-only and mounts on the client.
export default async function Video2GuitarRoute({ params }: DemoRouteProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Video2Guitar />;
}
