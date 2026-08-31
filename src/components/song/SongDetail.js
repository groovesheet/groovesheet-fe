// Song detail page — composition for /explore/:songId.
// Fetches the real library track, builds playback engines for whatever assets
// exist (stems → Web Audio mixer, midi → soundfont synth, musicxml → OSMD)
// and binds them all to one shared transport so position/play state survive
// tab switches. Stems-only tracks never touch the midi/musicxml code paths.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../layout/Header';
import Footer from '../layout/Footer';
import NotFound from '../NotFound';
import { useTheme } from '../../context/ThemeContext';
import { useLocalizedNavigate } from '../../i18n/locale';
import { Icon } from './icons';
import PlaybackBar from './PlaybackBar';
import SongSidebar from './SongSidebar';
import CardRow from './CardRow';
import { SheetMusicView, PianoRollView, StemsView } from './SongViewers';
import DrumGridView from './DrumGridView';
import FretboardView from './FretboardView';
import InstrumentDropdown from './InstrumentDropdown';
import { fetchLibraryTrack, fetchLibraryTracks, postTrackPlay, downloadLibraryTrackZip } from '../../utils/libraryApi';
import {
  trackExploreView,
  trackPlay,
  trackDownloadIntent,
  trackDownload,
  trackScoreView,
  trackStemSolo,
} from '../../utils/analytics';
import { useAuth, useUser } from '../../auth';
import usePageMeta from '../../hooks/usePageMeta';
import { seededDifficulty, seededViews, seededRating } from '../../utils/cosmeticStats';
import { createTransport } from '../../player/transport';
import { useTransport } from '../../player/transport-react';
import { createStemEngine, pickStemAssets } from '../../player/stemEngine';
import { createMidiEngine } from '../../player/midiEngine';
import { parseSyncMap, createSheetSecMapper, musicXmlHasVariableTempo } from '../../player/syncMap';
import { applyMusicXmlMetadata } from '../../utils/musicXmlMetadata';
import './Song.css';

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// Backend stem_name → display label / signature color (Explore palette).
const STEM_META = {
  vocals: { label: 'Vocals', color: '#7CC4FF', sub: 'lead · voice' },
  drums: { label: 'Drums', color: '#FF7BA9', sub: 'kit · percussion' },
  bass: { label: 'Bass', color: '#FFC857', sub: 'sub · low end' },
  guitar: { label: 'Guitar', color: '#84F2A6', sub: 'strings · plucked' },
  piano: { label: 'Piano', color: '#7AA2FF', sub: 'keys · harmonic' },
  other: { label: 'Other', color: '#C9A0FF', sub: 'texture · residual' },
};
const STEM_ORDER = ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'];

/**
 * Fetch an asset body off its presigned stream_url. Presigned URLs expire
 * (~900s), so on failure the track is refetched ONCE and the matching fresh
 * asset retried.
 */
async function fetchAssetWithRefresh(asset, trackId, as /* 'arrayBuffer' | 'text' | 'json' */) {
  const grab = async (a) => {
    if (!a || !a.stream_url) throw new Error('asset has no stream URL');
    const res = await fetch(a.stream_url);
    if (!res.ok) throw new Error(`asset request failed (HTTP ${res.status})`);
    return res[as]();
  };
  try {
    return await grab(asset);
  } catch (firstErr) {
    const fresh = await fetchLibraryTrack(trackId);
    const assets = fresh.assets || [];
    const match =
      assets.find((a) => a.id === asset.id) ||
      assets.find(
        (a) =>
          a.asset_type === asset.asset_type &&
          a.format === asset.format &&
          (a.stem_name || null) === (asset.stem_name || null)
      );
    if (!match) throw firstErr;
    return grab(match);
  }
}

function fmtDur(s) {
  if (!Number.isFinite(s) || s <= 0) return '—';
  const m = Math.floor(s / 60);
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  return `${m}:${ss}`;
}

/** Map a library track to the card shape CardRow/MiniThumbCard expects. */
function trackToCard(t) {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    diff: seededDifficulty(t.id),
    rating: seededRating(t.id),
    views: seededViews(t.id, Number(t.popularity) || 0),
    dur: fmtDur(t.thumb_data?.duration_sec || t.duration_sec),
    previewUrls: t.preview_urls || {},
    thumbUrl: t.thumb_url || null,
  };
}

/** Stable id hash — seeds the "Recommended" rail's deterministic shuffle. */
function hashId(id) {
  let h = 0;
  const s = String(id || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function ViewerToolbar({ viewMode, onView, viewerInfo, available, noteLabel, instrumentUi }) {
  const tab = (key, IconCmp, label, kbd) => {
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
        <span className="gs-seg-kbd">{kbd}</span>
      </button>
    );
  };
  return (
    <div className="gs-viewer-toolbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="gs-seg" role="tablist">
          {tab('sheet', Icon.Sheet, 'Sheet music', '1')}
          {tab('midi', Icon.Midi, noteLabel || 'Piano roll', '2')}
          {tab('stems', Icon.Stems, 'Stems', '3')}
        </div>
        {instrumentUi}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{viewerInfo}</div>
    </div>
  );
}

function CenteredNotice({ title, body, actionLabel, onAction }) {
  return (
    <div style={{ padding: '120px 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>{title}</h1>
      {body && <p style={{ fontSize: 13, color: 'var(--color-muted-foreground)', marginBottom: 18 }}>{body}</p>}
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            border: '1px solid var(--color-border-light)',
            background: 'var(--color-surface-light)',
            color: 'var(--color-text)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  const block = (h, w = '100%') => (
    <div
      style={{
        height: h,
        width: w,
        borderRadius: 10,
        background: 'var(--color-surface-light)',
        border: '1px solid var(--color-border-light)',
        animation: 'pulse 1.4s ease-in-out infinite',
      }}
    />
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0 48px' }}>
      {block(64)}
      {block(44)}
      {block(420)}
      <style>{`@keyframes pulse { 0%,100% { opacity: .55 } 50% { opacity: .9 } }`}</style>
    </div>
  );
}

function SongDetail({ onLoginClick }) {
  const { songId } = useParams();
  const navigate = useLocalizedNavigate();
  const { isDarkMode, toggleTheme } = useTheme();
  const { getToken } = useAuth();
  const { isSignedIn } = useUser();
  const playSentRef = useRef(false);
  // One explore_track_view per resolved song, reset on client-side navigation
  // to another song (the component instance survives that).
  const viewSentRef = useRef(false);
  // Score engagement is reported once per song, on the first time the sheet
  // or notation tab is actually shown.
  const scoreViewSentRef = useRef(false);
  // Lets the stable onStemChange callback report the current track without
  // taking `track` as a dependency (which would re-create the handler and
  // remount the mixer rows on every track refresh).
  const trackRef = useRef(null);
  const [zipDownloading, setZipDownloading] = useState(false);

  // --- track fetch (declared below); page meta reads it once loaded --------

  // --- track fetch -----------------------------------------------------------
  const [track, setTrack] = useState(null);
  const [trackLoading, setTrackLoading] = useState(true);
  const [trackError, setTrackError] = useState(null); // { status, message }

  usePageMeta(
    track ? `${track.title} — ${track.artist}` : null,
    track ? `Listen and download sheet music, MIDI and stems for ${track.title} by ${track.artist}.` : null
  );

  useEffect(() => {
    let cancelled = false;
    setTrack(null);
    setTrackError(null);
    setTrackLoading(true);
    // New song, new play credit — the component instance survives client-side
    // navigation between songs, so the guard must reset here.
    playSentRef.current = false;
    viewSentRef.current = false;
    scoreViewSentRef.current = false;
    (async () => {
      try {
        // Pass the bearer (when signed in) so owners can open their own
        // private/unlisted tracks; visitors stay anonymous.
        const data = await fetchLibraryTrack(songId, getToken);
        if (!cancelled) {
          setTrack(data);
          // Funnel landing. Fires once per resolved track, after resolution
          // succeeds, so a 404 never counts as a view. `resolved_by` records
          // whether the visitor arrived on the stable slug or the raw UUID.
          if (!viewSentRef.current) {
            viewSentRef.current = true;
            trackExploreView(data, {
              resolved_by: data?.slug && String(songId) === String(data.slug) ? 'slug' : 'uuid',
              has_musicxml: (data?.assets || []).some((a) => a.asset_type === 'musicxml'),
              has_midi: (data?.assets || []).some((a) => a.asset_type === 'midi'),
              stem_count: (data?.assets || []).filter((a) => a.asset_type === 'stem').length,
            });
          }
        }
      } catch (err) {
        if (!cancelled) setTrackError({ status: err.status, message: err.message });
      } finally {
        if (!cancelled) setTrackLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [songId]);

  // --- asset mapping -----------------------------------------------------------
  const stemAssetsByName = useMemo(() => pickStemAssets(track?.assets), [track]);
  // Waveforms computed client-side by the stem engine for tracks whose
  // thumb_data was never populated server-side. name -> number[] (0-100).
  const [localWaves, setLocalWaves] = useState({});
  const stems = useMemo(() => {
    const names = Array.from(stemAssetsByName.keys());
    const ordered = STEM_ORDER.filter((n) => names.includes(n)).concat(
      names.filter((n) => !STEM_ORDER.includes(n))
    );
    return ordered.map((name) => ({
      name,
      label: STEM_META[name]?.label || name.charAt(0).toUpperCase() + name.slice(1),
      color: STEM_META[name]?.color || '#8d8c8d',
      sub: STEM_META[name]?.sub || '',
      wave: track?.thumb_data?.stems?.[name] || localWaves[name] || null,
    }));
  }, [stemAssetsByName, track, localWaves]);

  // All note assets, per instrument. A track may carry several MIDI/MusicXML
  // parts (adtof_drums_midi, transkun_v2_piano_midi, …) — the selected
  // instrument picks which one the viewers load.
  const midiAssets = useMemo(
    () => (track?.assets || []).filter((a) => a.asset_type === 'midi' || a.format === 'mid'),
    [track]
  );
  const xmlAssets = useMemo(
    () => (track?.assets || []).filter((a) => a.asset_type === 'musicxml' || a.format === 'musicxml'),
    [track]
  );

  // --- selected instrument — single source of truth for the viewer toolbar
  // dropdown AND the sidebar select. Options come from the audio stems plus
  // any note assets whose stem has no audio.
  const instrumentOptions = useMemo(() => {
    const names = new Set(stems.map((s) => s.name));
    midiAssets.concat(xmlAssets).forEach((a) => {
      if (a.stem_name) names.add(a.stem_name);
    });
    const ordered = STEM_ORDER.filter((n) => names.has(n)).concat(
      Array.from(names).filter((n) => !STEM_ORDER.includes(n))
    );
    return ordered.map((name) => ({
      name,
      label: STEM_META[name]?.label || name.charAt(0).toUpperCase() + name.slice(1),
      color: STEM_META[name]?.color || '#8d8c8d',
      hasNotes: midiAssets.some((a) => a.stem_name === name),
      hasScore: xmlAssets.some((a) => a.stem_name === name),
    }));
  }, [stems, midiAssets, xmlAssets]);

  const [instrument, setInstrument] = useState(null);
  useEffect(() => {
    // Re-seed per track: prefer the first instrument that actually has note
    // data so the sheet/roll tabs open on something renderable.
    const first =
      instrumentOptions.find((o) => o.hasScore || o.hasNotes) || instrumentOptions[0] || null;
    setInstrument(first ? first.name : null);
  }, [instrumentOptions]);

  // Tab 2's view follows the SELECTED instrument, so the tab renames the
  // moment you pick Drums/Guitar/Bass — even on legacy tracks whose note
  // assets carry no stem attribution. Mirrors the backend's _note_view_for().
  const viewForStem = (name) =>
    name === 'drums' ? 'drums' : name === 'guitar' || name === 'bass' ? 'fretboard' : 'roll';
  const noteView = viewForStem(instrument);
  const noteLabel =
    noteView === 'drums' ? 'Drum Visualizer' : noteView === 'fretboard' ? 'Fretboard Notes' : 'Piano roll';

  // MIDI: exact part match for the selected instrument. Legacy fallback to an
  // un-attributed part applies only to the roll — feeding a pitched part into
  // the kit/fretboard visualizers would render nonsense hits.
  const midiAsset = useMemo(() => {
    const exact = midiAssets.find((a) => a.stem_name === instrument);
    if (exact) return exact;
    if (noteView !== 'roll') return null;
    return midiAssets.find((a) => !a.stem_name) || midiAssets[0] || null;
  }, [midiAssets, instrument, noteView]);
  // Sheet music: a mismatched score is still a score, so keep the fallback.
  const xmlAsset = useMemo(
    () =>
      xmlAssets.find((a) => a.stem_name === instrument) ||
      xmlAssets.find((a) => !a.stem_name) ||
      xmlAssets[0] ||
      null,
    [xmlAssets, instrument]
  );
  const syncMapAsset = useMemo(
    () => (track?.assets || []).find((a) => a.asset_type === 'sync_map') || null,
    [track]
  );

  const hasStems = stems.length > 0;
  const hasMidi = Boolean(midiAsset);
  const hasSheet = Boolean(xmlAsset);
  const available = useMemo(
    () => ({ sheet: hasSheet, midi: hasMidi, stems: hasStems }),
    [hasSheet, hasMidi, hasStems]
  );

  // --- view (tab) ----------------------------------------------------------------
  const [view, setView] = useState(null);
  useEffect(() => {
    if (!track) return;
    const first = ['sheet', 'midi', 'stems'].find((v) => available[v]) || null;
    setView(first);
  }, [track, available]);

  // Mirror the resolved track into a ref for the stable mixer callback.
  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  // score_view: first time this song's notation is actually on screen.
  useEffect(() => {
    if (!track || scoreViewSentRef.current) return;
    if (view !== 'sheet' && view !== 'midi') return;
    scoreViewSentRef.current = true;
    trackScoreView(track, {
      note_view: noteView,
      asset_format: view === 'sheet' ? 'musicxml' : 'midi',
    });
  }, [track, view, noteView]);

  // --- shared transport -------------------------------------------------------
  const transportRef = useRef(null);
  if (!transportRef.current) transportRef.current = createTransport();
  const transport = transportRef.current;
  const tState = useTransport(transport);
  // Pause (not dispose) so React StrictMode's dev double-invoke of effects
  // doesn't leave the render-created transport permanently disposed.
  useEffect(() => () => transportRef.current.pause(), []);

  // True audio duration: thumb_data.duration_sec, NOT the Spotify metadata one.
  const durationSec = track?.thumb_data?.duration_sec || track?.duration_sec || 0;
  useEffect(() => {
    const t = transportRef.current;
    t.pause();
    t.seek(0);
    t.setDuration(durationSec);
  }, [track, durationSec]);

  // --- volume (master gain) ------------------------------------------------------
  const [volume, setVolume] = useState(78);
  const [muted, setMuted] = useState(false);
  const masterVolRef = useRef(0.78);
  const stemEngineRef = useRef(null);
  const midiEngineRef = useRef(null);
  useEffect(() => {
    const v = muted ? 0 : volume / 100;
    masterVolRef.current = v;
    if (stemEngineRef.current) stemEngineRef.current.setMasterVolume(v);
    if (midiEngineRef.current) midiEngineRef.current.setMasterVolume(v);
  }, [volume, muted]);

  // --- stem engine -----------------------------------------------------------------
  const [stemProgress, setStemProgress] = useState(null); // { loaded, total, phase }
  const [stemError, setStemError] = useState(null);
  const [stemState, setStemState] = useState({});

  useEffect(() => {
    if (!track || !hasStems) return undefined;
    const trackId = track.id;
    setStemError(null);
    setStemProgress(null);
    setLocalWaves({});
    // Compute waveforms client-side only for stems the API gave no thumb for.
    const thumbStems = track.thumb_data?.stems || {};
    const needsWaves = Array.from(pickStemAssets(track.assets).keys()).some(
      (name) => !thumbStems[name]
    );
    const engine = createStemEngine({
      assets: track.assets,
      onProgress: (p) => setStemProgress(p),
      onError: (err) => setStemError(err.message || 'Failed to load stems'),
      onPeaks: needsWaves
        ? (name, peaks) => {
            if (thumbStems[name]) return;
            setLocalWaves((prev) => (prev[name] ? prev : { ...prev, [name]: peaks }));
          }
        : undefined,
      refreshAssets: async () => (await fetchLibraryTrack(trackId)).assets,
    });
    engine.setMasterVolume(masterVolRef.current);
    stemEngineRef.current = engine;
    const t = transportRef.current;
    t.attachEngine(engine);
    return () => {
      t.detachEngine('stems');
      engine.dispose();
      if (stemEngineRef.current === engine) stemEngineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  // Per-stem mixer state, re-seeded per track. `stems` identity also changes
  // when client-side waveforms stream in — keep the user's mix in that case.
  const mixerTrackIdRef = useRef(null);
  useEffect(() => {
    const fresh = mixerTrackIdRef.current !== (track && track.id);
    mixerTrackIdRef.current = track && track.id;
    setStemState((prev) => {
      const next = {};
      stems.forEach((s) => {
        next[s.name] = (!fresh && prev[s.name]) || { mute: false, solo: false, volume: 75 };
      });
      return next;
    });
  }, [track, stems]);

  // Apply mixer state to the engine (multi-solo UI semantics → per-stem mutes).
  useEffect(() => {
    const eng = stemEngineRef.current;
    if (!eng) return;
    const anySolo = Object.values(stemState).some((s) => s && s.solo);
    Object.entries(stemState).forEach(([name, s]) => {
      if (!s) return;
      eng.setStemGain(name, s.volume / 100);
      eng.setStemMuted(name, s.mute || (anySolo && !s.solo));
    });
  }, [stemState, track]);

  const onStemChange = useCallback(
    (name, patch) => {
      // Solo is the stem-engagement signal in the funnel; mute and volume are
      // ordinary mixing and are deliberately not reported.
      if (patch && typeof patch.solo === 'boolean') {
        trackStemSolo(trackRef.current, {
          stem_name: name,
          action: patch.solo ? 'on' : 'off',
        });
      }
      setStemState((s) => ({ ...s, [name]: { ...(s[name] || {}), ...patch } }));
    },
    []
  );

  // --- midi engine (only when a midi asset exists) -----------------------------------
  const [midiBuffer, setMidiBuffer] = useState(null);
  const [midiLoading, setMidiLoading] = useState(false);
  const [midiError, setMidiError] = useState(null);

  useEffect(() => {
    if (!track || !midiAsset) return undefined;
    let cancelled = false;
    let engine = null;
    const t = transportRef.current;
    setMidiBuffer(null);
    setMidiError(null);
    setMidiLoading(true);
    (async () => {
      try {
        const buf = await fetchAssetWithRefresh(midiAsset, track.id, 'arrayBuffer');
        if (cancelled) return;
        setMidiBuffer(buf);
        engine = createMidiEngine({
          midiBuffer: buf,
          onError: (err) => setMidiError(err.message || 'Failed to parse MIDI'),
        });
        engine.setMasterVolume(masterVolRef.current);
        midiEngineRef.current = engine;
        t.attachEngine(engine);
        // If this engine is already the active one (user is on the tab),
        // bring it to the current position / play state.
        if (t.getActiveEngineId() === 'midi') {
          const st = t.getState();
          if (st.isPlaying) engine.play(st.positionSec);
          else engine.seek(st.positionSec);
        }
      } catch (err) {
        if (!cancelled) setMidiError(err.message || 'Failed to load MIDI');
      } finally {
        if (!cancelled) setMidiLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      t.detachEngine('midi');
      if (engine) engine.dispose();
      if (midiEngineRef.current === engine) midiEngineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, midiAsset]);

  // --- ghost parts for the piano roll ------------------------------------------------
  // Other pitched instruments render faint behind the selected one. Loaded
  // best-effort; failures just mean no ghosts. Drum parts are excluded (they
  // have their own grid), and the drum grid itself never shows ghosts.
  const [ghosts, setGhosts] = useState([]);
  useEffect(() => {
    const others = midiAssets.filter(
      (a) =>
        a !== midiAsset &&
        a.stem_name &&
        (a.note_view ? a.note_view !== 'drums' : a.stem_name !== 'drums')
    );
    if (!track || noteView !== 'roll' || !others.length) {
      setGhosts([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const loaded = await Promise.all(
        others.map(async (a) => {
          try {
            const buffer = await fetchAssetWithRefresh(a, track.id, 'arrayBuffer');
            return {
              name: a.stem_name,
              color: STEM_META[a.stem_name]?.color || '#8d8c8d',
              buffer,
            };
          } catch (e) {
            return null;
          }
        })
      );
      if (!cancelled) setGhosts(loaded.filter(Boolean));
    })();
    return () => {
      cancelled = true;
    };
  }, [track, midiAsset, midiAssets, noteView]);

  // --- OSMD (sheet) engine — mirrors PreviewPanel's wiring; only when musicxml exists ---
  const [musicXmlText, setMusicXmlText] = useState(null);
  const [xmlLoading, setXmlLoading] = useState(false);
  const [xmlError, setXmlError] = useState(null);

  const osmdRef = useRef(null);
  const osmdSyncRef = useRef({ time: 0, playing: false, duration: 0, ready: false });
  const mapperRef = useRef(createSheetSecMapper({}));
  const syncPairsRef = useRef(null);
  const scoreHasOwnTimingRef = useRef(false);
  const sheetDurRef = useRef(0);
  const pendingOsmdSyncRef = useRef(false);
  // After commanding OSMD to seek, its clock reports stale time for a few
  // frames; readTime() returns null until it settles (see PreviewPanel).
  const osmdExpectRef = useRef(null); // { sheetSec, until } | null

  const rebuildMapper = useCallback(() => {
    mapperRef.current = createSheetSecMapper({
      pairs: syncPairsRef.current,
      sheetDurationSec: sheetDurRef.current,
      preferIdentity: scoreHasOwnTimingRef.current,
    });
  }, []);

  useEffect(() => {
    if (!track || !xmlAsset) return undefined;
    let cancelled = false;
    setMusicXmlText(null);
    setXmlError(null);
    setXmlLoading(true);
    syncPairsRef.current = null;
    scoreHasOwnTimingRef.current = false;
    sheetDurRef.current = 0;
    rebuildMapper();
    (async () => {
      try {
        const [xmlText, syncJson] = await Promise.all([
          fetchAssetWithRefresh(xmlAsset, track.id, 'text'),
          syncMapAsset
            ? fetchAssetWithRefresh(syncMapAsset, track.id, 'json').catch(() => null)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        scoreHasOwnTimingRef.current = musicXmlHasVariableTempo(xmlText);
        if (syncJson) {
          try {
            syncPairsRef.current = parseSyncMap(syncJson).pairs;
          } catch (e) {
            syncPairsRef.current = null; // bad sync map → identity mapping
          }
          rebuildMapper();
        }
        setMusicXmlText(applyMusicXmlMetadata(xmlText, {
          title: track.title,
          artist: 'Transcribed by GrooveSheet',
          sourceCredit: track.artist ? `Song by ${track.artist}` : undefined,
        }));
      } catch (err) {
        if (!cancelled) setXmlError(err.message || 'Failed to load score');
      } finally {
        if (!cancelled) setXmlLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [track, xmlAsset, syncMapAsset, rebuildMapper]);

  // OSMD's playFromMs awaits pause() internally, so an unawaited seek racing a
  // play() can start playback from 0. Serialize commands like PreviewPanel does.
  const osmdCmdQueueRef = useRef(Promise.resolve());
  const commandOsmd = useCallback((sheetSec, andPlay) => {
    if (!osmdRef.current) return;
    osmdExpectRef.current = { sheetSec, until: nowMs() + 4000 };
    osmdCmdQueueRef.current = osmdCmdQueueRef.current
      .then(async () => {
        const osmd = osmdRef.current; // re-read: instance may have remounted
        if (!osmd) return;
        try { await osmd.seekMs?.(sheetSec * 1000); } catch (e) { /* ignore */ }
        // Re-check at execution time: the user may have paused or switched
        // tabs while this command sat in the queue.
        const t = transportRef.current;
        if (andPlay && t.getState().isPlaying && t.getActiveEngineId() === 'osmd') {
          try { await osmd.play?.(); } catch (e) { /* ignore */ }
        }
        // Commands done — give OSMD's clock a short settle window from NOW.
        const expect = osmdExpectRef.current;
        if (expect && expect.sheetSec === sheetSec) {
          osmdExpectRef.current = { sheetSec, until: nowMs() + 1500 };
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!track || !hasSheet) return undefined;
    const t = transportRef.current;
    t.attachEngine({
      id: 'osmd',
      play: (atSec) => {
        if (!osmdRef.current || !osmdSyncRef.current.ready) {
          pendingOsmdSyncRef.current = true;
          return;
        }
        commandOsmd(mapperRef.current.midiSecToSheetSec(atSec), true);
      },
      pause: () => {
        try { osmdRef.current?.pause?.(); } catch (e) { /* ignore */ }
      },
      seek: (sec) => {
        if (!osmdRef.current || !osmdSyncRef.current.ready) {
          pendingOsmdSyncRef.current = true;
          return;
        }
        commandOsmd(mapperRef.current.midiSecToSheetSec(sec), false);
      },
      readTime: () => {
        const s = osmdSyncRef.current;
        if (!s.ready) return null;
        const eff = s.time;
        const expect = osmdExpectRef.current;
        if (expect) {
          const settled = Math.abs(eff - expect.sheetSec) <= 0.75;
          if (!settled && nowMs() < expect.until) return null; // stale — self-advance
          if (!settled) return null; // never adopt a clock that missed its target
          osmdExpectRef.current = null;
        }
        return mapperRef.current.sheetSecToMidiSec(eff);
      },
    });
    return () => {
      t.detachEngine('osmd');
    };
  }, [track, hasSheet, commandOsmd]);

  const handleOsmdStateChange = useCallback(
    (s) => {
      const t = transportRef.current;
      osmdSyncRef.current = { time: s.currentTime, playing: s.isPlaying, duration: s.duration, ready: true };
      if (s.duration > 0 && sheetDurRef.current !== s.duration) {
        sheetDurRef.current = s.duration;
        rebuildMapper();
      }
      // Deferred sync: OSMD just became ready after a tab switch/remount.
      if (pendingOsmdSyncRef.current && osmdRef.current && t.getActiveEngineId() === 'osmd') {
        pendingOsmdSyncRef.current = false;
        const st = t.getState();
        commandOsmd(mapperRef.current.midiSecToSheetSec(st.positionSec), st.isPlaying);
      }
      // Reconcile: OSMD pauses itself at the end of the sheet.
      if (t.getActiveEngineId() === 'osmd') {
        const st = t.getState();
        if (
          st.isPlaying && !s.isPlaying && s.duration > 0 &&
          s.currentTime >= s.duration - 0.05 && st.positionSec > 0.5
        ) {
          t.pause();
        }
      }
    },
    [rebuildMapper, commandOsmd]
  );

  // Cursor-follow: while another engine drives the clock and the sheet is
  // mounted, move the OSMD cursor along (copy of PreviewPanel's pattern).
  useEffect(() => {
    if (!hasSheet) return undefined;
    const t = transportRef.current;
    return t.subscribe((st) => {
      if (t.getActiveEngineId() === 'osmd') return;
      const osmd = osmdRef.current;
      if (!osmd) return;
      try { osmd.syncCursorToTime?.(mapperRef.current.midiSecToSheetSec(st.positionSec)); } catch (e) { /* ignore */ }
    });
  }, [hasSheet]);

  // --- active engine follows the visible tab ---------------------------------------
  useEffect(() => {
    if (!track || !view) return;
    const t = transportRef.current;
    if (view === 'sheet') {
      // Native OSMD playback advances its audio and cursor from one
      // PlaybackManager. MIDI remains available only on the visualizer tab.
      osmdSyncRef.current = { ...osmdSyncRef.current, ready: false };
      pendingOsmdSyncRef.current = true;
      t.setActiveEngine('osmd');
    } else if (view === 'midi') {
      t.setActiveEngine('midi');
    } else if (view === 'stems') {
      t.setActiveEngine('stems');
    }
  }, [view, track]);

  // --- playback handlers ---------------------------------------------------------
  const handlePlayPause = useCallback(() => {
    const t = transportRef.current;
    const st = t.getState();
    if (st.isPlaying) t.pause();
    else {
      if (st.durationSec > 0 && st.positionSec >= st.durationSec) t.seek(0);
      t.play();
      // Count one real play per page view (server dedupes per viewer/hour).
      if (!playSentRef.current && track?.id) {
        playSentRef.current = true;
        postTrackPlay(track.id);
        // GA4 alongside the existing backend counter, not instead of it: the
        // backend number stays the authority for the public play count.
        trackPlay(track, { view_mode: view });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id, view]);

  const handleZipDownload = useCallback(async () => {
    if (!track?.id || zipDownloading) return;
    // Intent fires before the request, so a download that ends at the sign-in
    // prompt is still measured as intent. `getToken` is always a function, so
    // the signed-in flag has to come from the auth state, not from its presence.
    trackDownloadIntent(track, { authenticated: Boolean(isSignedIn) });
    setZipDownloading(true);
    try {
      const { blob, filename } = await downloadLibraryTrackZip(track.id, getToken);
      trackDownload(track, {
        asset_count: (track.assets || []).length,
        bytes: blob?.size || 0,
      });
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
      if ((err.status === 401 || err.status === 403) && onLoginClick) onLoginClick();
    } finally {
      setZipDownloading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id, zipDownloading, getToken, onLoginClick, isSignedIn]);

  const onSeekFraction = useCallback((f) => {
    const t = transportRef.current;
    const dur = t.getState().durationSec;
    if (dur > 0) t.seek(Math.max(0, Math.min(1, f)) * dur);
  }, []);

  // Keyboard shortcuts (space = play/pause, 1/2/3 = available tabs).
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /(input|textarea|select)/i.test(e.target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      }
      if (e.key === '1' && available.sheet) setView('sheet');
      if (e.key === '2' && available.midi) setView('midi');
      if (e.key === '3' && available.stems) setView('stems');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePlayPause, available]);

  // --- related rails -----------------------------------------------------------------
  // One fetch; every rail below the viewer (and the sidebar's "More by {artist}")
  // is a client-side slice of this raw track list.
  const [related, setRelated] = useState([]);
  useEffect(() => {
    let cancelled = false;
    setRelated([]);
    (async () => {
      try {
        const data = await fetchLibraryTracks({ limit: 24 });
        if (cancelled) return;
        setRelated((data.tracks || []).filter((t) => t.id !== songId));
      } catch (e) {
        if (!cancelled) setRelated([]); // hide the rails on failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [songId]);

  const rails = useMemo(() => {
    if (!related.length) return [];
    const cards = (list) => list.map(trackToCard);
    const recommended = [...related].sort((a, b) => hashId(a.id) - hashId(b.id));
    const trending = [...related].sort(
      (a, b) =>
        (Number(b.popularity) || 0) - (Number(a.popularity) || 0) ||
        seededViews(b.id, 0) - seededViews(a.id, 0)
    );
    const newest = [...related].sort(
      (a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0)
    );
    const out = [
      {
        key: 'recommended',
        title: 'Recommended scores',
        subtitle: 'Picked from the GrooveSheet library — close in energy and instrumentation.',
        items: cards(recommended),
        variant: 'mix',
      },
      {
        key: 'trending',
        title: 'Trending now',
        subtitle: 'What musicians are practicing this week.',
        items: cards(trending),
        variant: 'mix',
      },
      {
        key: 'new',
        title: 'New this week',
        subtitle: 'The latest transcriptions and stem packs in the catalog.',
        items: cards(newest),
        variant: 'sheet',
      },
    ];
    if (track) {
      const byArtist = related.filter((t) => t.artist === track.artist);
      if (byArtist.length) {
        out.push({
          key: 'artist',
          title: `More from ${track.artist}`,
          subtitle: `Every ${track.artist} track in the GrooveSheet library.`,
          items: cards(byArtist),
          variant: 'sheet',
        });
      }
    }
    return out;
  }, [related, track]);

  const goToSong = useCallback((s) => navigate(`/explore/${s.id}`), [navigate]);

  // --- drawer ---------------------------------------------------------------------------
  const [drawerOpen, setDrawerOpen] = useState(false);

  // --- derived UI bits ---------------------------------------------------------------
  const stemStatusText = stemError
    ? 'Stems failed to load'
    : stemProgress && stemProgress.loaded < stemProgress.total
      ? `${stemProgress.phase === 'decode' ? 'Decoding' : 'Loading'} stems… ${stemProgress.loaded}/${stemProgress.total}`
      : null;

  const viewerInfo =
    view === 'sheet' ? (
      <span style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>
        Engraved with <strong style={{ color: 'var(--color-text)' }}>GrooveSheet OSMD</strong>
      </span>
    ) : view === 'midi' ? (
      <span style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>
        {noteView === 'drums'
          ? 'Drum visualizer · pieces flash on their hits'
          : noteView === 'fretboard'
            ? 'Fretboard notes · falling onto their string and fret'
            : 'MIDI piano roll · click the roll to seek'}
      </span>
    ) : view === 'stems' ? (
      <span style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>
        {stems.length} isolated stems · {stemStatusText || 'drag the timeline to scrub'}
      </span>
    ) : null;

  // Only a real 404 means "track gone" — anything else (422, 5xx) is a bug or
  // outage and must surface as a load error, not masquerade as a missing track.
  const notFound = trackError && trackError.status === 404;

  if (notFound) {
    return <NotFound title="Track not found" body="It may have been removed from the library. Let's get you back to the downbeat." />;
  }

  return (
    <div className="gs-song-page">
      {/* Dot grid */}
      <div className="gs-dotgrid" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Full-bleed site header + hairline divider, identical to /explore.
            Both stay OUTSIDE the two-column shell so the sidebar column never
            constrains them. */}
        <Header onLoginClick={onLoginClick} />
        <div className="gs-nav-divider" />

        {trackError && (
          <CenteredNotice
            title="Could not load this track"
            body={trackError.message}
            actionLabel="Back to explore"
            onAction={() => navigate('/explore')}
          />
        )}

        {!trackError && trackLoading && (
          <div className="gs-song-shell">
            <div style={{ minWidth: 0 }}>
              <LoadingSkeleton />
            </div>
            <div className="gs-song-sidebar-desktop" />
          </div>
        )}

        {!trackError && !trackLoading && track && (
          <>
            <div className="gs-song-shell">
              {/* Main column */}
              <div style={{ minWidth: 0 }}>
                {/* Sticky header: playback bar + view switcher pinned together */}
                <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--color-tinted-background)', padding: 0 }}>
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

                  {/* Viewer toolbar — instrument switcher hidden on the Stems
                      tab (the mixer is inherently all-instruments) */}
                  <ViewerToolbar
                    viewMode={view}
                    onView={setView}
                    viewerInfo={viewerInfo}
                    available={available}
                    noteLabel={noteLabel}
                    instrumentUi={
                      view !== 'stems' && instrumentOptions.length > 1 ? (
                        <InstrumentDropdown
                          options={instrumentOptions}
                          value={instrument}
                          onChange={setInstrument}
                        />
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
                    />
                  )}
                  {view === 'midi' && hasMidi && noteView !== 'roll' && !midiAsset && (
                    <CenteredNotice
                      title={`No ${STEM_META[instrument]?.label || instrument} transcription yet`}
                      body="This track doesn't have note data for this instrument. Pick another instrument from the dropdown above."
                    />
                  )}
                  {view === 'midi' && hasMidi && noteView === 'drums' && midiAsset && (
                    <DrumGridView
                      midiBuffer={midiBuffer}
                      transport={transport}
                      loading={midiLoading}
                      error={midiError}
                    />
                  )}
                  {view === 'midi' && hasMidi && noteView === 'fretboard' && midiAsset && (
                    <FretboardView
                      midiBuffer={midiBuffer}
                      transport={transport}
                      loading={midiLoading}
                      error={midiError}
                      kind={instrument}
                    />
                  )}
                  {view === 'midi' && hasMidi && noteView === 'roll' && (
                    <PianoRollView
                      midiBuffer={midiBuffer}
                      transport={transport}
                      loading={midiLoading}
                      error={midiError}
                      ghosts={ghosts}
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
                  {!view && (
                    <CenteredNotice title="No playable assets yet" body="This track has not been processed." />
                  )}
                </div>

                {/* Below-viewer rails — design-style slices of the related tracks */}
                {rails.map((rail) => (
                  <CardRow
                    key={rail.key}
                    title={rail.title}
                    subtitle={rail.subtitle}
                    items={rail.items}
                    variant={rail.variant}
                    onCardClick={goToSong}
                  />
                ))}
              </div>

              {/* Right sidebar (desktop) — keyed by track so display-only
                  select state reseeds when navigating between songs */}
              <div className="gs-song-sidebar-desktop">
                <SongSidebar
                  key={track.id}
                  track={track}
                  stems={stems}
                  instrumentOptions={instrumentOptions}
                  instrument={instrument}
                  onInstrument={setInstrument}
                  relatedTracks={related}
                  onSongClick={goToSong}
                  isSignedIn={isSignedIn}
                  onDownload={handleZipDownload}
                  onLoginClick={onLoginClick}
                  downloading={zipDownloading}
                />
              </div>
            </div>

            {/* Mobile sidebar drawer */}
            <button className="gs-rs-toggle" onClick={() => setDrawerOpen(true)}>
              Open info panel
            </button>
            {drawerOpen && (
              <>
                <div className="gs-rs-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
                <div className="gs-rs-drawer">
                  <SongSidebar
                    key={track.id}
                    track={track}
                    stems={stems}
                  instrumentOptions={instrumentOptions}
                  instrument={instrument}
                  onInstrument={setInstrument}
                    relatedTracks={related}
                    onSongClick={goToSong}
                    isSignedIn={isSignedIn}
                    onDownload={handleZipDownload}
                    onLoginClick={onLoginClick}
                    downloading={zipDownloading}
                  />
                </div>
              </>
            )}
          </>
        )}

        <Footer />
      </div>
    </div>
  );
}

export default SongDetail;
