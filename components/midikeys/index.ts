/**
 * The /midi-keyboard practice workstation: Web MIDI, Web Audio and canvas all
 * touch the browser, so the module loads with ssr: false through clientOnly
 * and only the fallback is in the HTML.
 */
'use client';

import type { ComponentType } from 'react';
import { clientOnly } from '@/components/ClientOnly';

export const MidiKeys = clientOnly<Record<string, never>>(() =>
  import('./MidiKeys').then((m) => ({ default: m.default as ComponentType<Record<string, never>> }))
);

export default MidiKeys;
