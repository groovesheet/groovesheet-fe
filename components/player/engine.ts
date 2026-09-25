/**
 * Typed entry to the player engines (P1 contract, see CONTRACT.md).
 *
 * Plain functions, no components. They create AudioContexts, fetch and
 * decode audio, so call them from effects or event handlers in a Client
 * Component, never during render and never from a Server Component.
 *
 * Importing this module is safe on the server (nothing touches window at
 * import time), but createMidiEngine pulls in osmd-extended (about 1.4MB).
 * A Client Component that only needs the engine after interaction can
 * `await import('@/components/player/engine')` instead.
 */
import { createTransport as createTransportJs } from './core/transport';
import { useTransport as useTransportJs } from './core/transport-react';
import {
  createStemEngine as createStemEngineJs,
  pickStemAssets as pickStemAssetsJs,
} from './core/stemEngine';
import { createMidiEngine as createMidiEngineJs } from './core/midiEngine';
import {
  parseSyncMap as parseSyncMapJs,
  createSheetSecMapper as createSheetSecMapperJs,
  musicXmlHasVariableTempo as musicXmlHasVariableTempoJs,
} from './core/syncMap';
import {
  mixBlobsToWav as mixBlobsToWavJs,
  blobDurationSec as blobDurationSecJs,
} from './core/mixdown';
import { fmtTime as fmtTimeJs } from './mocks/songDetailData';
import type {
  LibraryAsset,
  MidiEngine,
  MidiEngineOptions,
  ParsedSyncMap,
  SheetSecMapper,
  SheetSecMapperOptions,
  StemEngine,
  StemEngineOptions,
  Transport,
  TransportState,
} from './types';

/** One shared clock per player; engines attach to it (MIDI seconds are truth). */
export const createTransport: () => Transport = createTransportJs;

/** Re-renders on every transport tick. Pass null before the transport exists. */
export const useTransport: (transport: Transport | null) => TransportState =
  useTransportJs;

/** Web Audio mixer over a library track's stem assets. */
export const createStemEngine: (options: StemEngineOptions) => StemEngine =
  createStemEngineJs;

/** One playable asset per stem name (mp3 preferred, then opus, then wav). */
export const pickStemAssets: (
  assets: LibraryAsset[] | null | undefined
) => Map<string, LibraryAsset> = pickStemAssetsJs;

/** Soundfont synth over raw .mid bytes (osmd-extended's audio player). */
export const createMidiEngine: (options: MidiEngineOptions) => MidiEngine = createMidiEngineJs;

/** Validates a *_sync_map.json payload (object or JSON string); throws on bad input. */
export const parseSyncMap: (json: unknown) => ParsedSyncMap = parseSyncMapJs;

export const createSheetSecMapper: (options?: SheetSecMapperOptions) => SheetSecMapper =
  createSheetSecMapperJs;

/** True when the score carries more than one tempo, so OSMD's own timing is kept. */
export const musicXmlHasVariableTempo: (xmlString: string | null | undefined) => boolean =
  musicXmlHasVariableTempoJs;

/** Mixes stem blobs into one WAV (OfflineAudioContext); throws when given nothing to mix. */
export const mixBlobsToWav: (blobs: Blob[]) => Promise<{ blob: Blob; durationSec: number }> =
  mixBlobsToWavJs;

export const blobDurationSec: (blob: Blob) => Promise<number> = blobDurationSecJs;

/** Seconds to mm:ss, as the playback bar shows it. */
export const fmtTime: (seconds: number) => string = fmtTimeJs;

export type {
  LibraryAsset,
  MidiEngine,
  MidiEngineOptions,
  ParsedSyncMap,
  SheetSecMapper,
  SheetSecMapperOptions,
  StemEngine,
  StemEngineOptions,
  Transport,
  TransportState,
};
