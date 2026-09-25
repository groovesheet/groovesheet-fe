/**
 * Prop and engine types for the player islands (P1 contract, see CONTRACT.md).
 *
 * The implementation under components/player/** is the CRA player ported
 * verbatim as plain JS (brief section 0, rule 4), so TypeScript cannot infer
 * useful types from it. These interfaces describe what the JS actually reads,
 * taken from the call sites in the CRA app. They are the stable surface P2 and
 * P5 code against; the JS behind them does not change.
 */
import type { ReactNode, RefObject } from 'react';
import type { GetToken } from '@/lib/api';
import type { DownloadedFile } from '@/lib/types';

/* ------------------------------------------------------------------ *
 * Transport (core/transport.js, core/transport-react.js)
 * ------------------------------------------------------------------ */

/** Snapshot published by the transport. positionSec is in MIDI seconds. */
export interface TransportState {
  positionSec: number;
  isPlaying: boolean;
  rate: number;
  durationSec: number;
}

/**
 * What the transport drives. Methods may be async; the transport calls them
 * fire-and-forget. seek() must preserve the engine's own play/pause state.
 */
export interface TransportEngine {
  id: string;
  play(atSec?: number): unknown;
  pause(): unknown;
  seek(sec: number): unknown;
  readTime(): number | null;
}

export interface Transport {
  play(): void;
  pause(): void;
  seek(sec: number): void;
  getPosition(): number;
  getState(): TransportState;
  /** Calls cb immediately and on every change or tick; returns an unsubscribe. */
  subscribe(cb: (state: TransportState) => void): () => void;
  setDuration(sec: number): void;
  setRate(rate: number): void;
  attachEngine(engine: TransportEngine): void;
  detachEngine(id: string): void;
  /** Exactly one engine advances the clock; null lets the transport self-advance. */
  setActiveEngine(id: string | null): void;
  getActiveEngineId(): string | null;
  dispose(): void;
}

/* ------------------------------------------------------------------ *
 * Engines (core/stemEngine.js, core/midiEngine.js)
 * ------------------------------------------------------------------ */

/** One entry of LibraryTrack.assets. Only stem rows with a stream_url are used. */
export interface LibraryAsset {
  asset_type?: string;
  stem_name?: string | null;
  format?: string | null;
  stream_url?: string | null;
  [key: string]: unknown;
}

export interface StemLoadProgress {
  loaded: number;
  total: number;
  phase: 'fetch' | 'decode';
}

export interface StemEngineOptions {
  assets: LibraryAsset[];
  onReady?: () => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: StemLoadProgress) => void;
  /** Waveform thumbnail for a stem, 0 to 100 per point, computed client-side. */
  onPeaks?: (stemName: string, peaks: number[]) => void;
  /** Refetch presigned URLs after one expires (they last about 900s). */
  refreshAssets?: () => Promise<LibraryAsset[] | null | undefined>;
}

export interface StemAnalysisOptions {
  sampleRate?: number;
  concurrency?: number;
  /** When given, each stem is handed over as it decodes and the result Map stays empty. */
  onStem?: (name: string, samples: Float32Array | null) => unknown;
}

export interface StemEngine extends TransportEngine {
  /** 0 to 1. */
  setStemGain(name: string, vol: number): void;
  setStemMuted(name: string, muted: boolean): void;
  /** Stem name, or null to clear solo. */
  setSolo(name: string | null): void;
  setMasterVolume(v: number): void;
  getAnalysisSamples(options?: StemAnalysisOptions): Promise<Map<string, Float32Array | null>>;
  getStemNames(): string[];
  isReady(): boolean;
  dispose(): void;
}

export interface MidiEngineOptions {
  midiBuffer: ArrayBuffer | Uint8Array;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export interface MidiEngine extends TransportEngine {
  setMasterVolume(v: number): void;
  getDuration(): number;
  getNotes(): unknown[];
  dispose(): void;
}

/* ------------------------------------------------------------------ *
 * Sync map (core/syncMap.js)
 * ------------------------------------------------------------------ */

/** [scoreQuarterNote, midiSec] anchor pairs from a *_sync_map.json output. */
export type SyncPair = [number, number];

export interface ParsedSyncMap {
  version: unknown;
  pairs: SyncPair[];
}

/** Maps between MIDI seconds (transport truth) and OSMD sheet seconds. */
export interface SheetSecMapper {
  /** True when no usable sync map exists and both directions are the identity. */
  isIdentity: boolean;
  midiSecToSheetSec(sec: number): number;
  sheetSecToMidiSec(sheetSec: number): number;
}

export interface SheetSecMapperOptions {
  pairs?: SyncPair[] | null;
  sheetDurationSec?: number;
  preferIdentity?: boolean;
}

/* ------------------------------------------------------------------ *
 * OSMD (PreviewPanel/OSMDViewer.js)
 * ------------------------------------------------------------------ */

/** The imperative handle OSMDViewer exposes through its ref. */
export interface OSMDViewerHandle {
  play(): Promise<void>;
  pause(): Promise<void>;
  seekMs(ms: number): Promise<void>;
  setSpeed(factor: number): void;
  reset(): void;
  rerender(): void;
  getContainer(): HTMLDivElement | null;
  syncCursorToTime(sec: number): void;
}

/** Payload of OSMDViewer's onPlaybackStateChange, once per animation frame. */
export interface OSMDPlaybackState {
  /** Sheet seconds, at the current playback rate. */
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

/* ------------------------------------------------------------------ *
 * Song viewers (song/*), used by /explore/:songId and TranscriptionResultView
 * ------------------------------------------------------------------ */

/** Loading and error state every MIDI-driven viewer takes. */
interface MidiViewerBaseProps {
  midiBuffer: ArrayBuffer | null;
  transport: Transport | null;
  loading?: boolean;
  error?: string | null;
}

export interface SheetMusicViewProps {
  musicXmlText: string | null;
  loading?: boolean;
  error?: string | null;
  /** Receives the OSMDViewer handle; SongDetail drives the sheet through it. */
  osmdRef?: RefObject<OSMDViewerHandle | null>;
  onPlaybackStateChange?: (state: OSMDPlaybackState) => void;
  /** Sheet seconds, from a click on the score. */
  onSeekRequest?: (sheetSec: number) => void;
  footer?: ReactNode;
}

/** Another instrument's MIDI drawn faint behind the selected one. */
export interface PianoRollGhost {
  name: string;
  color: string;
  buffer: ArrayBuffer;
}

export interface PianoRollViewProps extends MidiViewerBaseProps {
  ghosts?: PianoRollGhost[] | null;
}

export type DrumGridViewProps = MidiViewerBaseProps;

export type FallingKeysViewProps = MidiViewerBaseProps;

export interface FretboardViewProps extends MidiViewerBaseProps {
  /** 'guitar' (default) or 'bass'; any other value falls back to guitar. */
  kind?: string;
}

/** One stem row: waveform from thumb_data.stems[name], values 0 to 100. */
export interface StemRow {
  name: string;
  label: string;
  color: string;
  sub?: string;
  wave?: number[] | null;
}

export interface StemUiState {
  mute: boolean;
  solo: boolean;
  /** 0 to 100. */
  volume: number;
}

export type StemStateMap = Record<string, StemUiState>;

export interface StemsViewProps {
  stems: StemRow[];
  stemState: StemStateMap;
  onStemChange: (name: string, patch: Partial<StemUiState>) => void;
  /** Fraction of the track, 0 to 1. */
  onSeek?: (fraction: number) => void;
  transport: Transport | null;
  statusText?: ReactNode;
  separatorName?: string;
  /** Stem audio still downloading: rows exist but have no waveform yet. */
  loading?: boolean;
}

export interface SpectrogramViewProps {
  stems: StemRow[];
  stemState: StemStateMap;
  onStemChange: (name: string, patch: Partial<StemUiState>) => void;
  onSeek?: (fraction: number) => void;
  transport: Transport | null;
  stemEngine: StemEngine | null;
  /** Cache key for the computed spectrogram. */
  trackId?: string | null;
  statusText?: ReactNode;
}

export interface InstrumentOption {
  name: string;
  label: string;
  color: string;
  hasNotes?: boolean;
  hasScore?: boolean;
}

export interface InstrumentDropdownProps {
  options: InstrumentOption[];
  value: string;
  onChange: (name: string) => void;
}

export interface PlaybackBarProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  currentSec: number;
  totalSec: number;
  tempo: number;
  onTempo: (tempo: number) => void;
  transpose: number;
  onTranspose: (semitones: number) => void;
  loopMode: string;
  onLoopMode: (mode: string) => void;
  loopRegion: { startBeat: number; endBeat: number } | null;
  volume: number;
  onVolume: (volume: number) => void;
  muted: boolean;
  onMute: () => void;
  metronome: boolean;
  onMetronome: (on: boolean) => void;
  dark: boolean;
  onToggleTheme: () => void;
  onFullscreen: () => void;
  /** Fraction of the track, 0 to 1. */
  onSeekFraction: (fraction: number) => void;
  totalBeats: number;
  /** true disables (but still shows) that control. */
  disabledControls?: Partial<Record<'tempo' | 'transpose' | 'metronome' | 'loop', boolean>>;
}

/* ------------------------------------------------------------------ *
 * Result and preview panels
 * ------------------------------------------------------------------ */

/**
 * Files already downloaded by the upload flow, keyed by output key
 * (e.g. 'musicxml', 'piano_midi'). Anything missing is fetched on demand.
 */
export type PrefetchedFiles = Record<string, DownloadedFile | null | undefined>;

export type TranscriptionResultInitialView = 'sheet' | 'midi' | 'stems' | 'spectrum';

export interface TranscriptionResultViewProps {
  workflowId: string | null;
  fileName?: string | null;
  selectedInstrument?: string | null;
  prefetchedFiles?: PrefetchedFiles | null;
  onDownloadTranscription?: (() => void) | null;
  onDownloadStem?: (() => void) | null;
  onDownloadMidi?: (() => void) | null;
  onDownloadPdf?: (() => void) | null;
  /** Shows the "new file" button when set; pass null on the history page. */
  onReset?: (() => void) | null;
  downloadError?: string | null;
  isSignedIn?: boolean;
  /** Preview (PRV) jobs only: awaited before the full run starts. */
  onUpgradeToFull?: () => unknown;
  onSignUpToUnlock?: () => void;
  /** 'overlay' (upload surfaces, default) or 'page' (/transcription-history/:id). */
  variant?: 'overlay' | 'page';
  title?: string | null;
  subtitle?: string | null;
  headerExtra?: ReactNode;
  /** Status payload output map ({ key: r2path }); every stem in it is loaded. */
  files?: Record<string, string> | null;
  /** Seconds, the clock for stem-only jobs before audio is measured. */
  durationHint?: number | null;
  defaultView?: TranscriptionResultInitialView;
  statusLabel?: string;
}

export interface PreviewPanelProps {
  workflowId: string;
  selectedInstrument: string;
  prefetchedFiles?: PrefetchedFiles | null;
  /** Demo mode: when either preloaded value is set nothing is fetched. */
  preloadedMusicXml?: string | null;
  preloadedMidiBuffer?: ArrayBuffer | null;
  preloadedSyncMap?: ParsedSyncMap | null;
}

export interface VisualizationPanelProps {
  jobId: string;
  selectedInstrument: string;
  fileName?: string | null;
  getToken: GetToken;
  onDownloadTranscription?: () => void;
  onDownloadStem?: () => void;
  onDownloadMidi?: () => void;
  onReset?: () => void;
  downloadError?: string | null;
}
