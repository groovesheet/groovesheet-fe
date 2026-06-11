// Song detail page — composition for /explore/:songId.
// Fetches the real library track, builds playback engines for whatever assets
// exist (stems → Web Audio mixer, midi → soundfont synth, musicxml → OSMD)
// and binds them all to one shared transport so position/play state survive
// tab switches. Stems-only tracks never touch the midi/musicxml code paths.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../layout/Header';
import Footer from '../layout/Footer';
import { useTheme } from '../../context/ThemeContext';
import { useLocalizedNavigate } from '../../i18n/locale';
import { Icon } from './icons';
import PlaybackBar from './PlaybackBar';
import SongSidebar from './SongSidebar';
import CardRow from './CardRow';
import { SheetMusicView, PianoRollView, StemsView } from './SongViewers';
import { fetchLibraryTrack, fetchLibraryTracks } from '../../utils/libraryApi';
import { createTransport } from '../../player/transport';
import { useTransport } from '../../player/transport-react';
import { createStemEngine, pickStemAssets } from '../../player/stemEngine';
import { createMidiEngine } from '../../player/midiEngine';
import { parseSyncMap, createSheetSecMapper } from '../../player/syncMap';
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
    diff: (t.formats || []).includes('musicxml') ? 'Score' : 'Stems',
    rating: Math.max(3, Math.min(5, 3 + (Number(t.popularity) || 0) / 50)),
    views: Number(t.popularity) || 0,
    dur: fmtDur(t.thumb_data?.duration_sec || t.duration_sec),
  };
}

function Breadcrumb({ title, artist, navigate }) {
  return (
    <div className="gs-breadcrumb">
      <a
        href="/explore"
        onClick={(e) => {
          e.preventDefault();
          navigate('/explore');
        }}
      >
        Explore
      </a>
      <span className="sep">/</span>
      <span style={{ color: 'var(--color-muted-foreground)' }}>{artist}</span>
      <span className="sep">/</span>
      <span className="current">{title}</span>
    </div>
  );
}

function ViewerToolbar({ viewMode, onView, viewerInfo, available }) {
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
      <div className="gs-seg" role="tablist">
        {tab('sheet', Icon.Sheet, 'Sheet music', '1')}
        {tab('midi', Icon.Midi, 'Piano roll', '2')}
        {tab('stems', Icon.Stems, 'Stems', '3')}
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

  // --- track fetch -----------------------------------------------------------
  const [track, setTrack] = useState(null);
  const [trackLoading, setTrackLoading] = useState(true);
  const [trackError, setTrackError] = useState(null); // { status, message }

  useEffect(() => {
    let cancelled = false;
    setTrack(null);
    setTrackError(null);
    setTrackLoading(true);
    (async () => {
      try {
        const data = await fetchLibraryTrack(songId);
        if (!cancelled) setTrack(data);
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
      wave: track?.thumb_data?.stems?.[name] || null,
    }));
  }, [stemAssetsByName, track]);

  const midiAsset = useMemo(
    () => (track?.assets || []).find((a) => a.asset_type === 'midi' || a.format === 'mid') || null,
    [track]
  );
  const xmlAsset = useMemo(
    () => (track?.assets || []).find((a) => a.asset_type === 'musicxml' || a.format === 'musicxml') || null,
    [track]
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

  // --- shared transport -------------------------------------------------------
  const transportRef = useRef(null);
  if (!transportRef.current) transportRef.current = createTransport();
  const transport = transportRef.current;
  const tState = useTransport(transport);
  useEffect(() => () => transportRef.current.dispose(), []);

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
    const engine = createStemEngine({
      assets: track.assets,
      onProgress: (p) => setStemProgress(p),
      onError: (err) => setStemError(err.message || 'Failed to load stems'),
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

  // Per-stem mixer state, re-seeded per track.
  useEffect(() => {
    const next = {};
    stems.forEach((s) => {
      next[s.name] = { mute: false, solo: false, volume: 75 };
    });
    setStemState(next);
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
    (name, patch) => setStemState((s) => ({ ...s, [name]: { ...(s[name] || {}), ...patch } })),
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

  // --- OSMD (sheet) engine — mirrors PreviewPanel's wiring; only when musicxml exists ---
  const [musicXmlText, setMusicXmlText] = useState(null);
  const [xmlLoading, setXmlLoading] = useState(false);
  const [xmlError, setXmlError] = useState(null);

  const osmdRef = useRef(null);
  const osmdSyncRef = useRef({ time: 0, playing: false, duration: 0, ready: false });
  const mapperRef = useRef(createSheetSecMapper({}));
  const syncPairsRef = useRef(null);
  const sheetDurRef = useRef(0);
  const pendingOsmdSyncRef = useRef(false);
  // After commanding OSMD to seek, its clock reports stale time for a few
  // frames; readTime() returns null until it settles (see PreviewPanel).
  const osmdExpectRef = useRef(null); // { sheetSec, until } | null

  const rebuildMapper = useCallback(() => {
    mapperRef.current = createSheetSecMapper({
      pairs: syncPairsRef.current,
      sheetDurationSec: sheetDurRef.current,
    });
  }, []);

  useEffect(() => {
    if (!track || !xmlAsset) return undefined;
    let cancelled = false;
    setMusicXmlText(null);
    setXmlError(null);
    setXmlLoading(true);
    syncPairsRef.current = null;
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
        if (syncJson) {
          try {
            syncPairsRef.current = parseSyncMap(syncJson).pairs;
          } catch (e) {
            syncPairsRef.current = null; // bad sync map → identity mapping
          }
          rebuildMapper();
        }
        setMusicXmlText(xmlText);
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

  const commandOsmd = useCallback((sheetSec, andPlay) => {
    const osmd = osmdRef.current;
    if (!osmd) return;
    osmdExpectRef.current = { sheetSec, until: nowMs() + 2000 };
    try { osmd.seekMs?.(sheetSec * 1000); } catch (e) { /* ignore */ }
    if (andPlay) { try { osmd.play?.(); } catch (e) { /* ignore */ } }
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
        const expect = osmdExpectRef.current;
        if (expect) {
          const settled = Math.abs(s.time - expect.sheetSec) <= 0.75;
          if (!settled && nowMs() < expect.until) return null; // stale — self-advance
          osmdExpectRef.current = null;
        }
        return mapperRef.current.sheetSecToMidiSec(s.time);
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
      // SheetMusicView remounts OSMD; not-ready until its first state tick.
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
    }
  }, []);

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

  // --- related rail ------------------------------------------------------------------
  const [related, setRelated] = useState([]);
  useEffect(() => {
    let cancelled = false;
    setRelated([]);
    (async () => {
      try {
        const data = await fetchLibraryTracks({ limit: 12 });
        if (cancelled) return;
        setRelated((data.tracks || []).filter((t) => t.id !== songId).map(trackToCard));
      } catch (e) {
        if (!cancelled) setRelated([]); // hide the rail on failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [songId]);

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
        MIDI piano roll · click the roll to seek
      </span>
    ) : view === 'stems' ? (
      <span style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>
        {stems.length} isolated stems · {stemStatusText || 'drag the timeline to scrub'}
      </span>
    ) : null;

  const notFound = trackError && (trackError.status === 404 || trackError.status === 422);

  return (
    <div className="gs-song-page">
      {/* Dot grid */}
      <div className="gs-dotgrid" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <Header onLoginClick={onLoginClick} />

        {trackError && (
          <CenteredNotice
            title={notFound ? 'Track not found' : 'Could not load this track'}
            body={notFound ? 'It may have been removed from the library.' : trackError.message}
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
            <Breadcrumb title={track.title} artist={track.artist} navigate={navigate} />

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

                  {/* Viewer toolbar */}
                  <ViewerToolbar viewMode={view} onView={setView} viewerInfo={viewerInfo} available={available} />
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
                  {view === 'midi' && hasMidi && (
                    <PianoRollView
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
                  {!view && (
                    <CenteredNotice title="No playable assets yet" body="This track has not been processed." />
                  )}
                </div>

                {/* Below-viewer rail */}
                {related.length > 0 && (
                  <CardRow
                    title="More from the library"
                    subtitle="Fresh transcriptions and stem packs from the GrooveSheet catalog."
                    items={related}
                    variant="mix"
                    onCardClick={goToSong}
                  />
                )}
              </div>

              {/* Right sidebar (desktop) */}
              <div className="gs-song-sidebar-desktop">
                <SongSidebar track={track} stems={stems} />
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
                  <SongSidebar track={track} stems={stems} onClose={() => setDrawerOpen(false)} />
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
