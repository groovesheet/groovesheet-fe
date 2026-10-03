/**
 * The /launchpad drum kit: Web MIDI and Web Audio only exist in the browser,
 * so the module loads with ssr: false through clientOnly.
 */
'use client';

import type { ComponentType } from 'react';
import { clientOnly } from '@/components/ClientOnly';

export const LaunchpadDrums = clientOnly<Record<string, never>>(() =>
  import('./LaunchpadDrums').then((m) => ({ default: m.default as ComponentType<Record<string, never>> }))
);

export default LaunchpadDrums;
