import { setRequestLocale } from 'next-intl/server';
import { MidiKeys } from '@/components/midikeys';
import { demoMetadata, type DemoRouteProps } from '../_components/demoMetadata';

export function generateMetadata(props: DemoRouteProps) {
  return demoMetadata(props, '/midi-keyboard', 'MIDI Keyboard: Play, Loop and Layer', 'A practice workstation for a MIDI keyboard: piano, drum pads, a one-button looper and a note visualizer.');
}

// A full-page tool like /bistable: no Header or Footer. Web MIDI, audio and
// the canvas only exist on the client.
export default async function MidiKeyboardRoute({ params }: DemoRouteProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MidiKeys />;
}
