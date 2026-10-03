import { setRequestLocale } from 'next-intl/server';
import { LaunchpadDrums } from '@/components/launchpad';
import { demoMetadata, type DemoRouteProps } from '../_components/demoMetadata';

export function generateMetadata(props: DemoRouteProps) {
  return demoMetadata(props, '/launchpad', 'Launchpad Drums: Play and Loop', 'A drum kit for a Novation Launchpad: 49 drums on the 8x8 grid, lit by type, with a one-button looper.');
}

// A full-page tool like /midi-keyboard: no Header or Footer. Web MIDI and
// audio only exist on the client.
export default async function LaunchpadRoute({ params }: DemoRouteProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LaunchpadDrums />;
}
