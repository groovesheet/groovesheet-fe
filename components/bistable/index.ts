/**
 * The Bistable installation page: Web MIDI, Web Audio, canvas and the
 * projection warp all touch the browser at import time, so the module loads
 * with ssr: false through clientOnly and only the fallback is in the HTML.
 */
'use client';

import type { ComponentType } from 'react';
import { clientOnly } from '@/components/ClientOnly';

export const Bistable = clientOnly<Record<string, never>>(() =>
  import('./Bistable').then((m) => ({ default: m.default as ComponentType<Record<string, never>> }))
);

export default Bistable;
