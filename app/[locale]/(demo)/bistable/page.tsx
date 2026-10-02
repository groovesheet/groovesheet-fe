import { setRequestLocale } from 'next-intl/server';
import { Bistable } from '@/components/bistable';
import { demoMetadata, type DemoRouteProps } from '../_components/demoMetadata';

export function generateMetadata(props: DemoRouteProps) {
  return demoMetadata(props, '/bistable', 'Bistable: MIDI Keyboard Projection', 'Projection-mapped falling notes driven by a MIDI keyboard or a library song.');
}

// A full-bleed installation frame, rendered as the whole page as App.js did:
// no Header or Footer. Web MIDI and the canvas only exist on the client.
export default async function BistableRoute({ params }: DemoRouteProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Bistable />;
}
