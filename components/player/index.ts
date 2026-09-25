/**
 * The player islands (P1 contract, see CONTRACT.md).
 *
 * Every component here is safe to render from a Server Component or a
 * prerendered Client Component: the browser-only ones (OSMD, Web Audio,
 * canvas, soundfont) load with ssr: false through clientOnly, so their
 * modules never run on the server and only a fallback is in the HTML.
 * Props that are functions can only be passed from a Client Component.
 *
 * Engines (transport, stem mixer, MIDI synth, sync maps) are in ./engine.
 */
'use client';

import { createElement, type ComponentType, type ReactNode, type SVGProps } from 'react';
import { clientOnly } from '@/components/ClientOnly';
import SkeletonPanel from '@/components/ui/SkeletonPanel';
import PlaybackBarJs from './song/PlaybackBar';
import InstrumentDropdownJs from './song/InstrumentDropdown';
import { Icon as IconJs } from './song/icons';
import type {
  DrumGridViewProps,
  FallingKeysViewProps,
  FretboardViewProps,
  InstrumentDropdownProps,
  PianoRollViewProps,
  PlaybackBarProps,
  PreviewPanelProps,
  SheetMusicViewProps,
  SpectrogramViewProps,
  StemsViewProps,
  TranscriptionResultViewProps,
  VisualizationPanelProps,
} from './types';

/*
 * The implementation is untyped JS (ported verbatim), and TypeScript infers
 * every destructured prop of a JS component as required `any`, which no real
 * props object satisfies. The interfaces in ./types are the contract, so the
 * JS component is taken as that type here, in one place.
 */
function asComponent<P>(component: unknown): ComponentType<P> {
  return component as ComponentType<P>;
}

function island<P extends object>(
  load: () => Promise<unknown>,
  fallback: ReactNode = null
): ComponentType<P> {
  return clientOnly<P>(
    () => load().then((component) => ({ default: asComponent<P>(component) })),
    { fallback }
  );
}

// Same placeholder the viewers show while their own data loads, so the swap
// from chunk-loading to data-loading is invisible.
const viewerFallback = createElement(SkeletonPanel, { count: 1, height: 420 });
const panelFallback = createElement(SkeletonPanel, { count: 1, height: 560 });

/* Result and preview panels ---------------------------------------- */

/** The finished-job player: sheet, MIDI roll, note views, stems, spectrum. */
export const TranscriptionResultView = island<TranscriptionResultViewProps>(
  () => import('./TranscriptionResult/TranscriptionResultView').then((m) => m.default),
  panelFallback
);

/** The /preview1 sample player (sheet, piano roll, 3D piano iframe). */
export const PreviewPanel = island<PreviewPanelProps>(
  () => import('./PreviewPanel/PreviewPanel').then((m) => m.default),
  panelFallback
);

/** Legacy result panel. No route renders it today; kept because it is part of the verbatim port. */
export const VisualizationPanel = island<VisualizationPanelProps>(
  () => import('./visualization/VisualizationPanel').then((m) => m.default),
  panelFallback
);

/* Song viewers (/explore/:songId) ----------------------------------- */

export const SheetMusicView = island<SheetMusicViewProps>(
  () => import('./song/SongViewers').then((m) => m.SheetMusicView),
  viewerFallback
);

export const PianoRollView = island<PianoRollViewProps>(
  () => import('./song/SongViewers').then((m) => m.PianoRollView),
  viewerFallback
);

export const StemsView = island<StemsViewProps>(
  () => import('./song/SongViewers').then((m) => m.StemsView),
  viewerFallback
);

export const DrumGridView = island<DrumGridViewProps>(
  () => import('./song/DrumGridView').then((m) => m.default),
  viewerFallback
);

export const FretboardView = island<FretboardViewProps>(
  () => import('./song/FretboardView').then((m) => m.default),
  viewerFallback
);

export const FallingKeysView = island<FallingKeysViewProps>(
  () => import('./song/FallingKeysView').then((m) => m.default),
  viewerFallback
);

export const SpectrogramView = island<SpectrogramViewProps>(
  () => import('./song/SpectrogramView').then((m) => m.default),
  viewerFallback
);

/*
 * Pure markup, no browser APIs: these server-render normally so the sticky
 * playback bar and the instrument switcher are in the first paint.
 */
export const PlaybackBar = asComponent<PlaybackBarProps>(PlaybackBarJs);
export const InstrumentDropdown = asComponent<InstrumentDropdownProps>(InstrumentDropdownJs);

export type IconName = keyof typeof IconJs;

/**
 * The song page's inline SVG set (Icon.Play, Icon.Sheet, ...). Use it from
 * Client Components: a Server Component would receive a client reference,
 * not the object.
 */
export const Icon: Record<IconName, ComponentType<SVGProps<SVGSVGElement>>> = IconJs;

/* Video frames (/video1, /video2for*) ------------------------------- */
// Full-bleed recording frames; nothing useful to show before they mount.

export const Video1 = island<Record<string, never>>(
  () => import('./video/Video1').then((m) => m.default)
);

export const Video2Piano = island<Record<string, never>>(
  () => import('./video/Video2Tabs').then((m) => m.default)
);

export const Video2Drums = island<Record<string, never>>(
  () => import('./video/Video2Drums').then((m) => m.default)
);

export const Video2Guitar = island<Record<string, never>>(
  () => import('./video/Video2Instrument').then((m) => m.Video2Guitar)
);

export const Video2Bass = island<Record<string, never>>(
  () => import('./video/Video2Instrument').then((m) => m.Video2Bass)
);

export type * from './types';
