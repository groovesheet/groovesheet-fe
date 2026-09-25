'use client';

// The song page body for /explore/:songId. The server hands over the track;
// this component builds playback engines for whatever assets exist (stems to
// the Web Audio mixer, midi to the soundfont synth, musicxml to OSMD) and
// binds them all to one shared transport so position and play state survive
// tab switches. Stems-only tracks never touch the midi/musicxml code paths.
//
// Everything that differs per visitor (sign-in state, the download button's
// behaviour, URL intent such as ?view= and ?instrument=) is resolved in the
// browser after hydration, so the server HTML is the same for everyone.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/chrome/Header';
import Footer from '@/components/chrome/Footer';
import { useLoginModal } from '@/components/chrome/LoginModalProvider';
import {
  DrumGridView,
  FallingKeysView,
  FretboardView,
  Icon,
  InstrumentDropdown,
  PianoRollView,
  PlaybackBar,
  SheetMusicView,
  SpectrogramView,
  StemsView,
  type InstrumentOption,
  type OSMDPlaybackState,
  type OSMDViewerHandle,
  type PianoRollGhost,
  type StemLoadProgress,
  type StemRow,
  type StemStateMap,
  type StemUiState,
  type SyncPair,
} from '@/components/player';
import {
  createMidiEngine,
  createSheetSecMapper,
  createStemEngine,
  createTransport,
  musicXmlHasVariableTempo,
  parseSyncMap,
  pickStemAssets,
  useTransport,
  type MidiEngine,
  type SheetSecMapper,
  type StemEngine,
} from '@/components/player/engine';
import '@/components/player/song/Song.css';
import { useTheme } from '@/lib/theme';
import { useAuth, useUser } from '@/lib/auth';
import { Link } from '@/lib/navigation';
import { fetchLibraryTrack, postTrackPlay, downloadLibraryTrackZip } from '@/lib/libraryApi';
import {
  trackExploreView,
  trackPlay,
  trackDownloadIntent,
  trackExploreUploadCta,
  trackDownload,
  trackScoreView,
  trackStemSolo,
} from '@/lib/analytics';
import { applyMusicXmlMetadata } from '@/lib/musicXmlMetadata';
import type { LibraryTrack } from '@/lib/types';
import Section from '../../_components/Section';
import trackToCard, { type SongCardModel } from '../../_components/trackToCard';
import type { CardVariant } from '../../_components/thumbs/resolveThumb';
import SongSidebar from './SongSidebar';
import UrlIntent, { type SongUrlIntent } from './UrlIntent';
import { assetKey, trackAssets, trackDurationSec, type SongAsset } from './songData';

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// Backend stem_name to display label / signature color (Explore palette).
const STEM_META: Record<string, { label: string; color: string; sub: string }> = {
  vocals: { label: 'Vocals', color: '#7CC4FF', sub: 'lead · voice' },
  drums: { label: 'Drums', color: '#FF7BA9', sub: 'kit · percussion' },
  bass: { label: 'Bass', color: '#FFC857', sub: 'sub · low end' },
  guitar: { label: 'Guitar', color: '#84F2A6', sub: 'strings · plucked' },
  piano: { label: 'Piano', color: '#7AA2FF', sub: 'keys · harmonic' },
  other: { label: 'Other', color: '#C9A0FF', sub: 'texture · residual' },
};
const STEM_ORDER = ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'];

const stemLabel = (name: string) => STEM_META[name]?.label || name.charAt(0).toUpperCase() + name.slice(1);
const stemColor = (name: string) => STEM_META[name]?.color || '#8d8c8d';

/**
 * GET an asset off its presigned stream_url. Presigned URLs expire (~900s), so
 * on failure the track is refetched ONCE and the matching fresh asset retried.
 */
async function fetchAssetWithRefresh(asset: SongAsset, trackId: string): Promise<Response> {
  const grab = async (a: SongAsset | undefined) => {
    if (!a || !a.stream_url) throw new Error('asset has no stream URL');
    const res = await fetch(a.stream_url);
    if (!res.ok) throw new Error(`asset request failed (HTTP ${res.status})`);
    return res;
  };
  try {
    return await grab(asset);
  } catch (firstErr) {
    const fresh = trackAssets(await fetchLibraryTrack(trackId));
    const match =
      fresh.find((a) => a.id && a.id === asset.id) ||
      fresh.find(
        (a) =>
          a.asset_type === asset.asset_type &&
          a.format === asset.format &&
          (a.stem_name || null) === (asset.stem_name || null)
      );
    if (!match) throw firstErr;
    return grab(match);
  }
}

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message) || fallback;

/** Stable id hash: seeds the "Recommended" rail's deterministic shuffle. */
function hashId(id: string): number {
  let h = 0;
  const s = String(id || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

type ViewKey = 'sheet' | 'midi' | 'notes' | 'keys' | 'stems' | 'spectrum';
type Availability = Record<ViewKey, boolean>;

// Tab order, and the digit shortcut each one answers to. Only the tabs a track
// actually has are rendered, and the digits are assigned over that filtered
// list so they always read 1,2,3... with no holes (VIEW_ORDER is also what the
// keyboard handler indexes into).
const VIEW_ORDER: ViewKey[] = ['sheet', 'midi', 'notes', 'keys', 'stems', 'spectrum'];

// `?view=` on /explore/:id: the rail a visitor clicked decides which tab the
// page opens on, so a card from "Popular MIDI" is not answered with the sheet
// music that also happens to exist. Each entry lists the tabs that satisfy the
// intent, best first; VIEW_FALLBACK catches everything else.
const VIEW_INTENTS: Record<ViewKey, ViewKey[]> = {
  sheet: ['sheet', 'midi', 'notes'],
  midi: ['midi', 'notes', 'keys', 'sheet'],
  notes: ['notes', 'midi', 'keys', 'sheet'],
  keys: ['keys', 'midi', 'notes', 'sheet'],
  stems: ['stems', 'spectrum'],
  spectrum: ['spectrum', 'stems'],
};
const VIEW_FALLBACK: ViewKey[] = ['sheet', 'midi', 'notes', 'keys', 'stems', 'spectrum'];

const isViewKey = (v: string | null): v is ViewKey => v !== null && v in VIEW_INTENTS;

/**
 * The tab to show given what this track+instrument actually has. `preferred`
 * is the tab the visitor chose, or their `?view=` intent; either is answered
 * with the nearest tab that has data, which for an untranscribed instrument
 * (guitar on a drums-only transcription) is the mixer. Because the preference
 * outlives an instrument that cannot show it, switching back to a transcribed
 * part returns you to the score you were reading.
 */
function resolveView(available: Availability, preferred: ViewKey | null): ViewKey | null {
  const order = (preferred ? VIEW_INTENTS[preferred] : []).concat(VIEW_FALLBACK);
  return order.find((v) => available[v]) || null;
}

type NoteView = 'drums' | 'fretboard' | 'roll';

// The instrument-specific note tab follows the SELECTED instrument, so the tab
// renames the moment you pick Drums/Guitar/Bass, even on legacy tracks whose
// note assets carry no stem attribution. Mirrors the backend's _note_view_for().
const viewForStem = (name: string | null): NoteView =>
  name === 'drums' ? 'drums' : name === 'guitar' || name === 'bass' ? 'fretboard' : 'roll';

/**
 * Notes and score both resolve to the SELECTED instrument's part. The
 * un-attributed fallback is for legacy tracks only: as soon as any part
 * carries a stem_name the attribution is trusted, so picking Guitar on a track
 * transcribed for drums reports "nothing here" instead of quietly handing back
 * the drum part, which is what made switching instruments look broken.
 */
function pickPart(assets: SongAsset[], name: string | null): SongAsset | null {
  const exact = assets.find((a) => a.stem_name === name);
  if (exact) return exact;
  if (assets.some((a) => a.stem_name)) return assets.find((a) => !a.stem_name) || null;
  return assets[0] || null;
}

/**
 * Which part the page shows: the visitor's pick, else an ?instrument= landing
 * when this track carries that part, else the first part with note data so the
 * sheet/roll tabs open on something renderable.
 */
function pickInstrument(options: InstrumentOption[], chosen: string | null, requested: string | null): string | null {
  const has = (name: string | null) => (name ? options.find((o) => o.name === name) : undefined);
  const first = has(chosen) || has(requested) || options.find((o) => o.hasScore || o.hasNotes) || options[0];
  return first ? first.name : null;
}

interface ViewerToolbarProps {
  viewMode: ViewKey | null;
  onView: (view: ViewKey) => void;
  viewerInfo: ReactNode;
  available: Availability;
  noteLabel: string;
  instrumentUi: ReactNode;
}

function ViewerToolbar({ viewMode, onView, viewerInfo, available, noteLabel, instrumentUi }: ViewerToolbarProps) {
  // Digit label per key: 1-based position among the AVAILABLE tabs.
  const kbdFor: Partial<Record<ViewKey, string>> = {};
  VIEW_ORDER.filter((k) => available[k]).forEach((k, i) => {
    kbdFor[k] = String(i + 1);
  });

  const tab = (key: ViewKey, IconCmp: (typeof Icon)[keyof typeof Icon], label: string) => {
    const enabled = Boolean(available[key]);
    return (
      <button
        className={viewMode === key ? 'on' : ''}
        onClick={() => enabled && onView(key)}
        disabled={!enabled}
        title={enabled ? undefined : 'Not yet transcribed'}
        style={enabled ? undefined : { opacity: 0.4, cursor: 'not-allowed' }}
      >
        <IconCmp />
        <span>{label}</span>
        <span className="gs-seg-kbd">{kbdFor[key]}</span>
      </button>
    );
  };
  return (
    <div className="gs-viewer-toolbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="gs-seg" role="tablist">
          {tab('sheet', Icon.Sheet, 'Sheet music')}
          {/* The raw piano roll of whatever MIDI the selected instrument has.
              It is the MIDI tab proper and never renames itself; the
              instrument-specific picture of the same notes is its own tab. */}
          {tab('midi', Icon.Midi, 'MIDI')}
          {available.notes ? tab('notes', Icon.Midi, noteLabel) : null}
          {/* Falling keys is a keyboard picture, so it is offered only for the
              pitched roll; a drum kit or a fretboard has its own visualiser. */}
          {available.keys ? tab('keys', Icon.Midi, 'Falling keys') : null}
          {tab('stems', Icon.Stems, 'Stems')}
          {/* Spectrum rides on the same stems, so it only appears with them. */}
          {available.spectrum ? tab('spectrum', Icon.Spectrum, 'Spectrum') : null}
        </div>
        {instrumentUi}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{viewerInfo}</div>
    </div>
  );
}

function CenteredNotice({ title, body }: { title: string; body?: string }) {
  return (
    <div style={{ padding: '120px 24px', textAlign: 'center' }}>
      <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>{title}</h2>
      {body && <p style={{ fontSize: 13, color: 'var(--color-muted-foreground)', marginBottom: 18 }}>{body}</p>}
    </div>
  );
}

const infoStyle = { fontSize: 12, color: 'var(--color-muted-foreground)' };

/** A fetched asset body, tagged with the asset it belongs to (see assetKey). */
interface Loaded<T> {
  key: string;
  value: T | null;
  error: string | null;
}

interface SongDetailProps {
  track: LibraryTrack;
  /** Recent library tracks for the rails, already without this one. */
  related: LibraryTrack[];
  /**
   * The server-rendered facts block (album, parts, downloads, links up to the
   * instrument hubs). Passed in rather than built here so it is in the HTML
   * for crawlers without this client component having to hydrate first.
   */
  facts?: ReactNode;
}

export default function SongDetail({ track: initialTrack, related, facts }: SongDetailProps) {
  // The page is keyed by track id, and a server refresh (after sign-in, say)
  // must not hand over a new object for the same track: every engine below is
  // keyed on it and would be torn down mid-playback.
  const [track] = useState(initialTrack);
  const { songId } = useParams<{ songId: string }>();
  const { isDarkMode, toggleTheme } = useTheme();
  const { getToken } = useAuth();
  const { isSignedIn, isLoaded: authLoaded } = useUser();
  const { openLoginModal } = useLoginModal();
  const playSentRef = useRef(false);
  const viewSentRef = useRef(false);
  // Score engagement is reported once per song, on the first time the sheet
  // or notation tab is actually shown.
  const scoreViewSentRef = useRef(false);
  const [zipDownloading, setZipDownloading] = useState(false);

  // --- URL intent (?view=, ?instrument=), read in the browser only --------
  const [intent, setIntent] = useState<SongUrlIntent>({ view: null, instrument: null });
  const intentRef = useRef<SongUrlIntent>(intent);
  // The visitor's own instrument pick, and their own tab (or null for "follow
  // the landing intent").
  const [instrumentChoice, setInstrumentChoice] = useState<string | null>(null);
  const [preferredView, setPreferredView] = useState<ViewKey | null>(null);

  const onIntent = useCallback((next: SongUrlIntent) => {
    const prev = intentRef.current;
    if (prev.view === next.view && prev.instrument === next.instrument) return;
    intentRef.current = next;
    setIntent(next);
    // A new landing intent wins over earlier picks, as a fresh visit would.
    if (prev.instrument !== next.instrument) setInstrumentChoice(null);
    if (prev.view !== next.view) setPreferredView(null);
  }, []);

  // Funnel landing, once per resolved track. `resolved_by` records whether
  // the visitor arrived on the stable slug or the raw UUID.
  useEffect(() => {
    if (viewSentRef.current) return;
    viewSentRef.current = true;
    const assets = trackAssets(track);
    trackExploreView(track, {
      resolved_by: track.slug && String(songId) === String(track.slug) ? 'slug' : 'uuid',
      has_musicxml: assets.some((a) => a.asset_type === 'musicxml'),
      has_midi: assets.some((a) => a.asset_type === 'midi'),
      stem_count: assets.filter((a) => a.asset_type === 'stem').length,
    });
  }, [track, songId]);

  // --- asset mapping ---------------------------------------------------------
  const assets = useMemo(() => trackAssets(track), [track]);
  const stemAssetsByName = useMemo(() => pickStemAssets(assets), [assets]);
  // Waveforms computed client-side by the stem engine for tracks whose
  // thumb_data was never populated server-side. name to number[] (0-100).
  const [localWaves, setLocalWaves] = useState<Record<string, number[]>>({});
  const stems = useMemo((): StemRow[] => {
    const names = Array.from(stemAssetsByName.keys());
    const ordered = STEM_ORDER.filter((n) => names.includes(n)).concat(names.filter((n) => !STEM_ORDER.includes(n)));
    return ordered.map((name) => ({
      name,
      label: stemLabel(name),
      color: stemColor(name),
      sub: STEM_META[name]?.sub || '',
      wave: track.thumb_data?.stems?.[name] || localWaves[name] || null,
    }));
  }, [stemAssetsByName, track, localWaves]);

  // All note assets, per instrument. A track may carry several MIDI/MusicXML
  // parts (adtof_drums_midi, transkun_v2_piano_midi, ...); the selected
  // instrument picks which one the viewers load.
  const midiAssets = useMemo(() => assets.filter((a) => a.asset_type === 'midi' || a.format === 'mid'), [assets]);
  const xmlAssets = useMemo(
    () => assets.filter((a) => a.asset_type === 'musicxml' || a.format === 'musicxml'),
    [assets]
  );

  // --- selected instrument: single source of truth for the viewer toolbar
  // dropdown AND the sidebar select. Options come from the audio stems plus
  // any note assets whose stem has no audio.
  const instrumentOptions = useMemo((): InstrumentOption[] => {
    const names = new Set(stems.map((s) => s.name));
    midiAssets.concat(xmlAssets).forEach((a) => {
      if (a.stem_name) names.add(a.stem_name);
    });
    const ordered = STEM_ORDER.filter((n) => names.has(n)).concat(
      Array.from(names).filter((n) => !STEM_ORDER.includes(n))
    );
    return ordered.map((name) => ({
      name,
      label: stemLabel(name),
      color: stemColor(name),
      hasNotes: midiAssets.some((a) => a.stem_name === name),
      hasScore: xmlAssets.some((a) => a.stem_name === name),
    }));
  }, [stems, midiAssets, xmlAssets]);

  const requestedInstrument = (intent.instrument || '').trim().toLowerCase() || null;
  const instrument = pickInstrument(instrumentOptions, instrumentChoice, requestedInstrument);

  const noteView = viewForStem(instrument);
  // Label for the instrument-specific note tab. The pitched roll has no such
  // tab (the MIDI tab already IS its picture), so 'roll' never reaches the UI.
  const noteLabel =
    noteView === 'drums' ? 'Drum Visualizer' : noteView === 'fretboard' ? 'Fretboard Notes' : 'Piano roll';

  const midiAsset = useMemo(() => pickPart(midiAssets, instrument), [midiAssets, instrument]);
  const xmlAsset = useMemo(() => pickPart(xmlAssets, instrument), [xmlAssets, instrument]);
  const syncMapAsset = useMemo(() => assets.find((a) => a.asset_type === 'sync_map') || null, [assets]);

  const hasStems = stems.length > 0;
  const hasMidi = Boolean(midiAsset);
  const hasSheet = Boolean(xmlAsset);
  const available = useMemo(
    (): Availability => ({
      sheet: hasSheet,
      // The piano roll renders any MIDI part, drums included, so the MIDI tab
      // stands wherever note data exists.
      midi: hasMidi,
      // The instrument's own picture of those same notes, for the instruments
      // that have one.
      notes: hasMidi && noteView !== 'roll',
      // Falling keys draws a piano keyboard, so it applies to the pitched roll
      // only; drums have the kit visualiser and bass/guitar the fretboard.
      keys: hasMidi && noteView === 'roll',
      stems: hasStems,
      // Overlaid stem spectrograms: same audio, same mixer state as Stems.
      spectrum: hasStems,
    }),
    [hasSheet, hasMidi, hasStems, noteView]
  );

  // --- view (tab) ------------------------------------------------------------
  const intentView = isViewKey(intent.view) ? intent.view : null;
  const view = resolveView(available, preferredView ?? intentView);

  // Explicit tab clicks are the visitor's own choice.
  const chooseView = useCallback((v: ViewKey) => setPreferredView(v), []);

  // score_view: first time this song's notation is actually on screen.
  useEffect(() => {
    if (scoreViewSentRef.current) return;
    if (view !== 'sheet' && view !== 'midi' && view !== 'notes') return;
    scoreViewSentRef.current = true;
    trackScoreView(track, {
      note_view: noteView,
      asset_format: view === 'sheet' ? 'musicxml' : 'midi',
    });
  }, [track, view, noteView]);

  // --- shared transport ------------------------------------------------------
  const [transport] = useState(createTransport);
  const tState = useTransport(transport);
  // Pause (not dispose) so React StrictMode's dev double-invoke of effects
  // doesn't leave the transport permanently disposed.
  useEffect(() => () => transport.pause(), [transport]);

  const durationSec = trackDurationSec(track);
  useEffect(() => {
    transport.pause();
    transport.seek(0);
    transport.setDuration(durationSec);
  }, [transport, durationSec]);

  // --- volume (master gain) ----------------------------------------------------
  const [volume, setVolume] = useState(78);
  const [muted, setMuted] = useState(false);
  const masterVolRef = useRef(0.78);
  const stemEngineRef = useRef<StemEngine | null>(null);
  const midiEngineRef = useRef<MidiEngine | null>(null);
  useEffect(() => {
    const v = muted ? 0 : volume / 100;
    masterVolRef.current = v;
    if (stemEngineRef.current) stemEngineRef.current.setMasterVolume(v);
    if (midiEngineRef.current) midiEngineRef.current.setMasterVolume(v);
  }, [volume, muted]);

  // --- stem engine -------------------------------------------------------------
  const [stemProgress, setStemProgress] = useState<StemLoadProgress | null>(null);
  const [stemError, setStemError] = useState<string | null>(null);
  // Same engine as stemEngineRef, but as state: the spectrum view needs to
  // re-run its analysis when a new engine is built.
  const [stemEngine, setStemEngine] = useState<StemEngine | null>(null);

  useEffect(() => {
    if (!hasStems) return undefined;
    const trackId = track.id;
    // Compute waveforms client-side only for stems the API gave no thumb for.
    const thumbStems = track.thumb_data?.stems || {};
    const needsWaves = Array.from(pickStemAssets(assets).keys()).some((name) => !thumbStems[name]);
    const engine = createStemEngine({
      assets,
      onProgress: (p) => setStemProgress(p),
      onError: (err) => setStemError(err.message || 'Failed to load stems'),
      onPeaks: needsWaves
        ? (name, peaks) => {
            if (thumbStems[name]) return;
            setLocalWaves((prev) => (prev[name] ? prev : { ...prev, [name]: peaks }));
          }
        : undefined,
      refreshAssets: async () => trackAssets(await fetchLibraryTrack(trackId)),
    });
    engine.setMasterVolume(masterVolRef.current);
    stemEngineRef.current = engine;
    // The engine is an external resource created here, and the spectrum view
    // takes it as a prop, so it has to be published as state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStemEngine(engine);
    transport.attachEngine(engine);
    return () => {
      transport.detachEngine('stems');
      engine.dispose();
      if (stemEngineRef.current === engine) stemEngineRef.current = null;
      setStemEngine((cur) => (cur === engine ? null : cur));
    };
  }, [track, assets, hasStems, transport]);

  // Per-stem mixer state: defaults plus whatever the visitor changed.
  const [stemOverrides, setStemOverrides] = useState<Record<string, Partial<StemUiState>>>({});
  const stemState = useMemo((): StemStateMap => {
    const next: StemStateMap = {};
    stems.forEach((s) => {
      next[s.name] = { mute: false, solo: false, volume: 75, ...stemOverrides[s.name] };
    });
    return next;
  }, [stems, stemOverrides]);

  // Apply mixer state to the engine (multi-solo UI semantics to per-stem mutes).
  useEffect(() => {
    if (!stemEngine) return;
    const anySolo = Object.values(stemState).some((s) => s && s.solo);
    Object.entries(stemState).forEach(([name, s]) => {
      if (!s) return;
      stemEngine.setStemGain(name, s.volume / 100);
      stemEngine.setStemMuted(name, s.mute || (anySolo && !s.solo));
    });
  }, [stemState, stemEngine]);

  // Picking an instrument is a mixer command too: the mixer should be playing
  // the part you just chose with the rest out of the way. That is what makes
  // selecting an untranscribed stem useful: the tab falls back to Stems and
  // the stem is already soloed there. Only user choices solo; the automatic
  // choice of instrument leaves the mix alone.
  const selectInstrument = useCallback(
    (name: string) => {
      // Keep the tab the visitor is reading as their preference, so a part
      // that cannot show it parks them on the nearest tab and the next part
      // that can brings them back.
      setPreferredView((p) => p ?? view);
      setInstrumentChoice(name);
      // Mirror the choice into the URL, so the address bar is always a link to
      // the part on screen. It replaces rather than pushes: switching parts is
      // not a page you want to walk back through one instrument at a time.
      const url = new URL(window.location.href);
      url.searchParams.set('instrument', name);
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      if (!stems.some((s) => s.name === name)) return; // this part has no audio stem
      setStemOverrides((prev) => {
        const next: Record<string, Partial<StemUiState>> = {};
        stems.forEach((s) => {
          next[s.name] = { ...prev[s.name], solo: s.name === name, mute: false };
        });
        return next;
      });
    },
    [view, stems]
  );

  const onStemChange = useCallback(
    (name: string, patch: Partial<StemUiState>) => {
      // Solo is the stem-engagement signal in the funnel; mute and volume are
      // ordinary mixing and are deliberately not reported.
      if (patch && typeof patch.solo === 'boolean') {
        trackStemSolo(track, { stem_name: name, action: patch.solo ? 'on' : 'off' });
      }
      setStemOverrides((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }));
    },
    [track]
  );

  // --- midi engine (only when a midi asset exists) -------------------------------
  const midiKey = midiAsset ? assetKey(midiAsset) : null;
  const [midiLoad, setMidiLoad] = useState<Loaded<ArrayBuffer> | null>(null);
  const midiCurrent = midiLoad && midiLoad.key === midiKey ? midiLoad : null;
  const midiBuffer = midiCurrent ? midiCurrent.value : null;
  const midiError = midiCurrent ? midiCurrent.error : null;
  const midiLoading = Boolean(midiKey) && !midiCurrent;

  useEffect(() => {
    if (!midiAsset || !midiKey) return undefined;
    let cancelled = false;
    let engine: MidiEngine | null = null;
    const key = midiKey;
    (async () => {
      try {
        const buf = await (await fetchAssetWithRefresh(midiAsset, track.id)).arrayBuffer();
        if (cancelled) return;
        setMidiLoad({ key, value: buf, error: null });
        engine = createMidiEngine({
          midiBuffer: buf,
          onError: (err) =>
            setMidiLoad((cur) =>
              cur && cur.key === key ? { ...cur, error: err.message || 'Failed to parse MIDI' } : cur
            ),
        });
        engine.setMasterVolume(masterVolRef.current);
        midiEngineRef.current = engine;
        transport.attachEngine(engine);
        // If this engine is already the active one (the visitor is on the
        // tab), bring it to the current position / play state.
        if (transport.getActiveEngineId() === 'midi') {
          const st = transport.getState();
          if (st.isPlaying) engine.play(st.positionSec);
          else engine.seek(st.positionSec);
        }
      } catch (err) {
        if (!cancelled) setMidiLoad({ key, value: null, error: errorMessage(err, 'Failed to load MIDI') });
      }
    })();
    return () => {
      cancelled = true;
      transport.detachEngine('midi');
      if (engine) engine.dispose();
      if (midiEngineRef.current === engine) midiEngineRef.current = null;
    };
  }, [track.id, midiAsset, midiKey, transport]);

  // --- ghost parts for the piano roll ----------------------------------------------
  // Other pitched instruments render faint behind the selected one. Loaded
  // best-effort; failures just mean no ghosts. Drum parts are excluded (they
  // have their own grid), and the drum grid itself never shows ghosts.
  const ghostAssets = useMemo(
    () =>
      noteView !== 'roll'
        ? []
        : midiAssets.filter(
            (a) =>
              a !== midiAsset &&
              a.stem_name &&
              (a.note_view ? a.note_view !== 'drums' : a.stem_name !== 'drums')
          ),
    [midiAssets, midiAsset, noteView]
  );
  const ghostKey = ghostAssets.map(assetKey).join(',');
  const [ghostLoad, setGhostLoad] = useState<{ key: string; list: PianoRollGhost[] }>({ key: '', list: [] });
  const ghosts = useMemo(
    () => (ghostKey && ghostLoad.key === ghostKey ? ghostLoad.list : []),
    [ghostKey, ghostLoad]
  );

  useEffect(() => {
    if (!ghostKey) return undefined;
    let cancelled = false;
    (async () => {
      const loaded = await Promise.all(
        ghostAssets.map(async (a): Promise<PianoRollGhost | null> => {
          try {
            const buffer = await (await fetchAssetWithRefresh(a, track.id)).arrayBuffer();
            return { name: a.stem_name || '', color: stemColor(a.stem_name || ''), buffer };
          } catch {
            return null;
          }
        })
      );
      if (!cancelled) {
        setGhostLoad({ key: ghostKey, list: loaded.filter((g): g is PianoRollGhost => g !== null) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [track.id, ghostAssets, ghostKey]);

  // --- OSMD (sheet) engine: mirrors PreviewPanel's wiring; only when musicxml exists ---
  const xmlKey = xmlAsset ? assetKey(xmlAsset) : null;
  const [xmlLoad, setXmlLoad] = useState<Loaded<string> | null>(null);
  const xmlCurrent = xmlLoad && xmlLoad.key === xmlKey ? xmlLoad : null;
  const musicXmlText = xmlCurrent ? xmlCurrent.value : null;
  const xmlError = xmlCurrent ? xmlCurrent.error : null;
  const xmlLoading = Boolean(xmlKey) && !xmlCurrent;

  const osmdRef = useRef<OSMDViewerHandle | null>(null);
  const osmdSyncRef = useRef({ time: 0, playing: false, duration: 0, ready: false });
  const mapperRef = useRef<SheetSecMapper | null>(null);
  const syncPairsRef = useRef<SyncPair[] | null>(null);
  const scoreHasOwnTimingRef = useRef(false);
  const sheetDurRef = useRef(0);
  const pendingOsmdSyncRef = useRef(false);
  // After commanding OSMD to seek, its clock reports stale time for a few
  // frames; readTime() returns null until it settles (see PreviewPanel).
  const osmdExpectRef = useRef<{ sheetSec: number; until: number } | null>(null);

  const rebuildMapper = useCallback(() => {
    mapperRef.current = createSheetSecMapper({
      pairs: syncPairsRef.current,
      sheetDurationSec: sheetDurRef.current,
      preferIdentity: scoreHasOwnTimingRef.current,
    });
  }, []);
  // Identity until a score and its sync map say otherwise.
  const mapper = useCallback((): SheetSecMapper => {
    if (!mapperRef.current) mapperRef.current = createSheetSecMapper({});
    return mapperRef.current;
  }, []);

  useEffect(() => {
    if (!xmlAsset || !xmlKey) return undefined;
    let cancelled = false;
    const key = xmlKey;
    syncPairsRef.current = null;
    scoreHasOwnTimingRef.current = false;
    sheetDurRef.current = 0;
    rebuildMapper();
    (async () => {
      try {
        const [xmlText, syncJson] = await Promise.all([
          fetchAssetWithRefresh(xmlAsset, track.id).then((r) => r.text()),
          syncMapAsset
            ? fetchAssetWithRefresh(syncMapAsset, track.id)
                .then((r): Promise<unknown> => r.json())
                .catch(() => null)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        scoreHasOwnTimingRef.current = musicXmlHasVariableTempo(xmlText);
        if (syncJson) {
          try {
            syncPairsRef.current = parseSyncMap(syncJson).pairs;
          } catch {
            syncPairsRef.current = null; // bad sync map, identity mapping
          }
          rebuildMapper();
        }
        setXmlLoad({
          key,
          error: null,
          value: applyMusicXmlMetadata(xmlText, {
            title: track.title,
            artist: 'Transcribed by GrooveSheet',
            sourceCredit: track.artist ? `Song by ${track.artist}` : undefined,
          }),
        });
      } catch (err) {
        if (!cancelled) setXmlLoad({ key, value: null, error: errorMessage(err, 'Failed to load score') });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [track.id, track.title, track.artist, xmlAsset, xmlKey, syncMapAsset, rebuildMapper]);

  // OSMD's playFromMs awaits pause() internally, so an unawaited seek racing a
  // play() can start playback from 0. Serialize commands like PreviewPanel does.
  const osmdCmdQueueRef = useRef<Promise<void>>(Promise.resolve());
  const commandOsmd = useCallback(
    (sheetSec: number, andPlay: boolean) => {
      if (!osmdRef.current) return;
      osmdExpectRef.current = { sheetSec, until: nowMs() + 4000 };
      osmdCmdQueueRef.current = osmdCmdQueueRef.current
        .then(async () => {
          const osmd = osmdRef.current; // re-read: instance may have remounted
          if (!osmd) return;
          try {
            await osmd.seekMs(sheetSec * 1000);
          } catch {
            /* ignore */
          }
          // Re-check at execution time: the visitor may have paused or
          // switched tabs while this command sat in the queue.
          if (andPlay && transport.getState().isPlaying && transport.getActiveEngineId() === 'osmd') {
            try {
              await osmd.play();
            } catch {
              /* ignore */
            }
          }
          // Commands done: give OSMD's clock a short settle window from NOW.
          const expect = osmdExpectRef.current;
          if (expect && expect.sheetSec === sheetSec) {
            osmdExpectRef.current = { sheetSec, until: nowMs() + 1500 };
          }
        })
        .catch(() => {});
    },
    [transport]
  );

  useEffect(() => {
    if (!hasSheet) return undefined;
    transport.attachEngine({
      id: 'osmd',
      play: (atSec?: number) => {
        if (!osmdRef.current || !osmdSyncRef.current.ready) {
          pendingOsmdSyncRef.current = true;
          return;
        }
        commandOsmd(mapper().midiSecToSheetSec(atSec ?? transport.getPosition()), true);
      },
      pause: () => {
        try {
          osmdRef.current?.pause();
        } catch {
          /* ignore */
        }
      },
      seek: (sec: number) => {
        if (!osmdRef.current || !osmdSyncRef.current.ready) {
          pendingOsmdSyncRef.current = true;
          return;
        }
        // Seeking pauses OSMD's PlaybackManager, so a seek during playback has
        // to ask for the restart; otherwise the transport keeps counting over
        // a silent score. commandOsmd re-checks isPlaying when it runs.
        commandOsmd(mapper().midiSecToSheetSec(sec), transport.getState().isPlaying);
      },
      readTime: () => {
        const s = osmdSyncRef.current;
        if (!s.ready) return null;
        const eff = s.time;
        const expect = osmdExpectRef.current;
        if (expect) {
          const settled = Math.abs(eff - expect.sheetSec) <= 0.75;
          if (!settled && nowMs() < expect.until) return null; // stale, self-advance
          if (!settled) return null; // never adopt a clock that missed its target
          osmdExpectRef.current = null;
        }
        return mapper().sheetSecToMidiSec(eff);
      },
    });
    return () => {
      transport.detachEngine('osmd');
    };
  }, [hasSheet, commandOsmd, mapper, transport]);

  const handleOsmdStateChange = useCallback(
    (s: OSMDPlaybackState) => {
      osmdSyncRef.current = { time: s.currentTime, playing: s.isPlaying, duration: s.duration, ready: true };
      if (s.duration > 0 && sheetDurRef.current !== s.duration) {
        sheetDurRef.current = s.duration;
        rebuildMapper();
      }
      // Deferred sync: OSMD just became ready after a tab switch/remount.
      if (pendingOsmdSyncRef.current && osmdRef.current && transport.getActiveEngineId() === 'osmd') {
        pendingOsmdSyncRef.current = false;
        const st = transport.getState();
        commandOsmd(mapper().midiSecToSheetSec(st.positionSec), st.isPlaying);
      }
      // Reconcile: OSMD pauses itself at the end of the sheet.
      if (transport.getActiveEngineId() === 'osmd') {
        const st = transport.getState();
        if (
          st.isPlaying &&
          !s.isPlaying &&
          s.duration > 0 &&
          s.currentTime >= s.duration - 0.05 &&
          st.positionSec > 0.5
        ) {
          transport.pause();
        }
      }
    },
    [rebuildMapper, commandOsmd, mapper, transport]
  );

  // A click on the score is a seek on the shared transport, in song seconds;
  // the viewer only knows sheet seconds.
  const handleSheetSeek = useCallback(
    (sheetSec: number) => {
      transport.seek(mapper().sheetSecToMidiSec(sheetSec));
    },
    [mapper, transport]
  );

  // Cursor-follow: while another engine drives the clock and the sheet is
  // mounted, move the OSMD cursor along (copy of PreviewPanel's pattern).
  useEffect(() => {
    if (!hasSheet) return undefined;
    return transport.subscribe((st) => {
      if (transport.getActiveEngineId() === 'osmd') return;
      const osmd = osmdRef.current;
      if (!osmd) return;
      try {
        osmd.syncCursorToTime(mapper().midiSecToSheetSec(st.positionSec));
      } catch {
        /* ignore */
      }
    });
  }, [hasSheet, mapper, transport]);

  // --- active engine follows the visible tab -------------------------------------
  useEffect(() => {
    if (!view) return;
    if (view === 'sheet') {
      // Native OSMD playback advances its audio and cursor from one
      // PlaybackManager. MIDI remains available only on the visualizer tab.
      osmdSyncRef.current = { ...osmdSyncRef.current, ready: false };
      pendingOsmdSyncRef.current = true;
      transport.setActiveEngine('osmd');
    } else if (view === 'midi' || view === 'notes' || view === 'keys') {
      // Piano roll, drum kit, fretboard and falling keys are four pictures of
      // the same MIDI part, played by the same engine.
      transport.setActiveEngine('midi');
    } else if (view === 'stems' || view === 'spectrum') {
      // The spectrum view is a second face on the stem mixer: same engine.
      transport.setActiveEngine('stems');
    }
  }, [view, transport]);

  // --- playback handlers -----------------------------------------------------------
  const handlePlayPause = useCallback(() => {
    const st = transport.getState();
    if (st.isPlaying) {
      transport.pause();
      return;
    }
    if (st.durationSec > 0 && st.positionSec >= st.durationSec) transport.seek(0);
    transport.play();
    // Count one real play per page view (server dedupes per viewer/hour).
    if (!playSentRef.current) {
      playSentRef.current = true;
      postTrackPlay(track.id);
      // GA4 alongside the existing backend counter, not instead of it: the
      // backend number stays the authority for the public play count.
      trackPlay(track, { view_mode: view });
    }
  }, [track, view, transport]);

  const handleZipDownload = useCallback(async () => {
    if (zipDownloading) return;
    // Intent fires before the request, so a download that ends at the sign-in
    // prompt is still measured as intent.
    trackDownloadIntent(track, { authenticated: Boolean(isSignedIn) });
    setZipDownloading(true);
    try {
      const { blob, filename } = await downloadLibraryTrackZip(track.id, getToken);
      trackDownload(track, { asset_count: assets.length, bytes: blob?.size || 0 });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Track download failed:', err);
      const status = err && typeof err === 'object' && 'status' in err ? err.status : null;
      if (status === 401 || status === 403) openLoginModal();
    } finally {
      setZipDownloading(false);
    }
  }, [track, assets, zipDownloading, getToken, isSignedIn, openLoginModal]);

  const onSeekFraction = useCallback(
    (f: number) => {
      const dur = transport.getState().durationSec;
      if (dur > 0) transport.seek(Math.max(0, Math.min(1, f)) * dur);
    },
    [transport]
  );

  // Keyboard shortcuts (space = play/pause, digits = available tabs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target && /(input|textarea|select)/i.test(target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      }
      // Digits index the available tabs in VIEW_ORDER, matching the labels
      // ViewerToolbar prints.
      const digit = parseInt(e.key, 10);
      if (digit >= 1 && digit <= 9) {
        const next = VIEW_ORDER.filter((k) => available[k])[digit - 1];
        if (next) chooseView(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePlayPause, available, chooseView]);

  // --- related rails -----------------------------------------------------------------
  // Every rail below the viewer (and the sidebar's "More by {artist}") is a
  // slice of the one related-track list the server fetched. They render
  // through the same Section and SongCard components Explore uses.
  const rails = useMemo(() => {
    if (!related.length) return [];
    const cards = (list: LibraryTrack[]) => list.map(trackToCard);
    const recommended = [...related].sort((a, b) => hashId(a.id) - hashId(b.id));
    const trending = [...related].sort(
      (a, b) =>
        (Number(b.popularity) || 0) - (Number(a.popularity) || 0) ||
        (Number(b.plays) || 0) - (Number(a.plays) || 0) ||
        (Number(b.downloads) || 0) - (Number(a.downloads) || 0)
    );
    const newest = [...related].sort(
      (a, b) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime()
    );
    const out: { key: string; title: string; subtitle: string; songs: SongCardModel[]; variant?: CardVariant }[] = [
      {
        key: 'recommended',
        title: 'Recommended scores',
        subtitle: 'Picked from the GrooveSheet library, close in energy and instrumentation.',
        songs: cards(recommended),
      },
      {
        key: 'trending',
        title: 'Trending now',
        subtitle: 'What musicians are practicing this week.',
        songs: cards(trending),
      },
      {
        key: 'new',
        title: 'New this week',
        subtitle: 'The latest transcriptions and stem packs in the catalog.',
        songs: cards(newest).filter((t) => t.formats.includes('musicxml')),
        variant: 'sheet',
      },
    ];
    const byArtist = related.filter((t) => t.artist === track.artist);
    if (byArtist.length) {
      out.push({
        key: 'artist',
        title: `More from ${track.artist}`,
        subtitle: `Every ${track.artist} track in the GrooveSheet library.`,
        songs: cards(byArtist),
      });
    }
    return out;
  }, [related, track]);

  // --- drawer ----------------------------------------------------------------------
  const [drawerOpen, setDrawerOpen] = useState(false);

  // --- derived UI bits -------------------------------------------------------------
  const stemStatusText = stemError
    ? 'Stems failed to load'
    : stemProgress && stemProgress.loaded < stemProgress.total
      ? `${stemProgress.phase === 'decode' ? 'Decoding' : 'Loading'} stems… ${stemProgress.loaded}/${stemProgress.total}`
      : null;

  const viewerInfo =
    view === 'sheet' ? (
      <span style={infoStyle}>
        Engraved with <strong style={{ color: 'var(--color-text)' }}>GrooveSheet OSMD</strong>
      </span>
    ) : view === 'midi' ? (
      <span style={infoStyle}>MIDI piano roll · {(instrument && STEM_META[instrument]?.label) || instrument} part</span>
    ) : view === 'notes' ? (
      <span style={infoStyle}>
        {noteView === 'drums'
          ? 'Drum visualizer · pieces flash on their hits'
          : 'Fretboard notes · falling onto their string and fret'}
      </span>
    ) : view === 'keys' ? (
      <span style={infoStyle}>Falling keys · notes land on the key they are played on</span>
    ) : view === 'stems' ? (
      <span style={infoStyle}>
        {stems.length} isolated stems · {stemStatusText || 'drag the timeline to scrub'}
      </span>
    ) : view === 'spectrum' ? (
      <span style={infoStyle}>
        {stemStatusText || 'Mel spectrograms of every stem, overlaid · toggle a layer to mute it'}
      </span>
    ) : null;

  const sidebar = (
    <SongSidebar
      track={track}
      stems={stems}
      instrumentOptions={instrumentOptions}
      instrument={instrument}
      onInstrument={selectInstrument}
      relatedTracks={related}
      isSignedIn={isSignedIn}
      authLoaded={authLoaded}
      onDownload={handleZipDownload}
      onLoginClick={openLoginModal}
      downloading={zipDownloading}
      scoreAsset={xmlAsset}
    />
  );

  return (
    <div className="gs-song-page">
      <Suspense fallback={null}>
        <UrlIntent onChange={onIntent} />
      </Suspense>

      {/* Dot grid */}
      <div className="gs-dotgrid" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Full-bleed site header + hairline divider, identical to /explore.
            Both stay OUTSIDE the two-column shell so the sidebar column never
            constrains them. */}
        <Header />
        <div className="gs-nav-divider" />

        <div className="gs-song-shell">
          {/* Main column */}
          <div style={{ minWidth: 0 }}>
            {/* Sticky header: playback bar + view switcher pinned together */}
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 20,
                background: 'var(--color-tinted-background)',
                padding: 0,
              }}
            >
              <PlaybackBar
                isPlaying={tState.isPlaying}
                onPlayPause={handlePlayPause}
                currentSec={tState.positionSec}
                totalSec={tState.durationSec}
                tempo={100}
                onTempo={() => {}}
                transpose={0}
                onTranspose={() => {}}
                loopMode="off"
                onLoopMode={() => {}}
                loopRegion={null}
                volume={volume}
                onVolume={setVolume}
                muted={muted}
                onMute={() => setMuted((m) => !m)}
                metronome={false}
                onMetronome={() => {}}
                dark={isDarkMode}
                onToggleTheme={toggleTheme}
                onFullscreen={() => {
                  if (document.fullscreenElement) document.exitFullscreen();
                  else document.documentElement.requestFullscreen?.();
                }}
                onSeekFraction={onSeekFraction}
                totalBeats={0}
                disabledControls={{ tempo: true, transpose: true, metronome: true, loop: true }}
              />

              {/* Viewer toolbar. The instrument switcher stays on EVERY tab,
                  including the mixer: it is how you get back to a transcribed
                  part after landing on Stems for one that has no notes. */}
              <ViewerToolbar
                viewMode={view}
                onView={chooseView}
                viewerInfo={viewerInfo}
                available={available}
                noteLabel={noteLabel}
                instrumentUi={
                  instrumentOptions.length > 1 && instrument ? (
                    <InstrumentDropdown options={instrumentOptions} value={instrument} onChange={selectInstrument} />
                  ) : null
                }
              />
            </div>

            {/* Viewer */}
            <div className="gs-viewer">
              {view === 'sheet' && hasSheet && (
                <SheetMusicView
                  musicXmlText={musicXmlText}
                  loading={xmlLoading}
                  error={xmlError}
                  osmdRef={osmdRef}
                  onPlaybackStateChange={handleOsmdStateChange}
                  onSeekRequest={handleSheetSeek}
                />
              )}
              {/* MIDI tab: the raw roll, for every instrument that has a part,
                  drums included. */}
              {view === 'midi' && hasMidi && (
                <PianoRollView
                  midiBuffer={midiBuffer}
                  transport={transport}
                  loading={midiLoading}
                  error={midiError}
                  ghosts={ghosts}
                />
              )}
              {view === 'notes' && hasMidi && noteView === 'drums' && (
                <DrumGridView midiBuffer={midiBuffer} transport={transport} loading={midiLoading} error={midiError} />
              )}
              {view === 'notes' && hasMidi && noteView === 'fretboard' && (
                <FretboardView
                  midiBuffer={midiBuffer}
                  transport={transport}
                  loading={midiLoading}
                  error={midiError}
                  kind={instrument || undefined}
                />
              )}
              {view === 'keys' && available.keys && (
                <FallingKeysView
                  midiBuffer={midiBuffer}
                  transport={transport}
                  loading={midiLoading}
                  error={midiError}
                />
              )}
              {view === 'stems' && hasStems && (
                <StemsView
                  stems={stems}
                  stemState={stemState}
                  onStemChange={onStemChange}
                  onSeek={onSeekFraction}
                  transport={transport}
                  statusText={stemStatusText}
                />
              )}
              {view === 'spectrum' && hasStems && (
                <SpectrogramView
                  stems={stems}
                  stemState={stemState}
                  onStemChange={onStemChange}
                  onSeek={onSeekFraction}
                  transport={transport}
                  stemEngine={stemEngine}
                  trackId={track.id}
                  statusText={stemStatusText}
                />
              )}
              {!view && <CenteredNotice title="No playable assets yet" body="This track has not been processed." />}
            </div>

            {/* What this track is, server-rendered (see TrackFacts). */}
            {facts}

            {/* Below-viewer rails: design-style slices of the related tracks */}
            {rails.map((rail) => (
              <Section
                key={rail.key}
                title={rail.title}
                subtitle={rail.subtitle}
                songs={rail.songs}
                variant={rail.variant}
              />
            ))}
          </div>

          {/* Right sidebar (desktop) */}
          <div className="gs-song-sidebar-desktop">{sidebar}</div>
        </div>

        {/* Same bridge as the sidebar's, for the widths where the sidebar is
            replaced by a drawer that starts closed. */}
        <Link
          className="gs-song-upload-cta-mobile"
          href="/"
          onClick={() => trackExploreUploadCta(track, { placement: 'mobile_inline' })}
        >
          <strong>Not the song you needed?</strong>
          <span>Transcribe your own audio &rarr;</span>
        </Link>

        {/* Mobile sidebar drawer */}
        <button className="gs-rs-toggle" onClick={() => setDrawerOpen(true)}>
          Open info panel
        </button>
        {drawerOpen && (
          <>
            <div className="gs-rs-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
            <div className="gs-rs-drawer">{sidebar}</div>
          </>
        )}

        <Footer />
      </div>
    </div>
  );
}
