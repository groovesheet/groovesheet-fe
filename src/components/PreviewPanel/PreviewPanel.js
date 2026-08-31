import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth';
import { downloadWorkflowFile, fetchMidiArrayBuffer, fetchMusicXmlText } from '../../utils/api';
import config from '../../config';
import PreviewTabs from './PreviewTabs';
import PreviewControls from './PreviewControls';
import PreviewBottomBar from './PreviewBottomBar';
import {
  MIDI_KEY_BY_INSTRUMENT,
  MUSICXML_KEY_BY_INSTRUMENT,
  SYNC_MAP_KEY_BY_INSTRUMENT,
  truncateMidiToSeconds,
} from './previewUtils';
import { createTransport } from '../../player/transport';
import { useTransport } from '../../player/transport-react';
import { createSheetSecMapper, parseSyncMap, musicXmlHasVariableTempo } from '../../player/syncMap';
import StatusMessage from '../ui/StatusMessage';
import SkeletonPanel from '../ui/SkeletonPanel';
import './PreviewPanel.css';

const MusicSheetTab = lazy(() => import('./tabs/MusicSheetTab'));
const PianoRollTab = lazy(() => import('./tabs/PianoRollTab'));

const TRANSCRIPTION_INSTRUMENTS = ['drums', 'piano', 'jazz_bass', 'bass'];

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export default function PreviewPanel({
  workflowId,
  selectedInstrument,
  prefetchedFiles,
  preloadedMusicXml,
  preloadedMidiBuffer,
  preloadedSyncMap,
}) {
  const auth = useAuth();
  const getToken = auth?.getToken;
  const [activeTab, setActiveTab] = useState('music_sheet');
  const [theme, setTheme] = useState('light');
  const [zoom, setZoom] = useState(1.0);
  const [musicXmlText, setMusicXmlText] = useState(preloadedMusicXml || null);
  const [midiBuffer, setMidiBuffer] = useState(preloadedMidiBuffer || null);
  const [xmlLoading, setXmlLoading] = useState(!preloadedMusicXml);
  const [midiLoading, setMidiLoading] = useState(false);
  const [xmlError, setXmlError] = useState(null);
  const [midiError, setMidiError] = useState(null);
  const [iframeUrl, setIframeUrl] = useState(null);
  const [speed, setSpeed] = useState(1);
  const containerRef = useRef(null);
  const osmdRef = useRef(null);
  const iframeRef = useRef(null);
  const blobUrlRef = useRef(null);

  // --- shared transport (MIDI seconds are truth) --------------------------
  // One transport instance per panel. Two engines:
  //   'osmd' — the sheet tab's OSMD PlaybackManager (its audio plays; we read
  //            position from onPlaybackStateChange).
  //   'midi' — the 3d-piano iframe (always mounted, hidden off the piano_3d
  //            tab). It is the audio source for the piano-roll and 3D tabs;
  //            we drive it via postMessage and read its 'state' messages.
  // Tab switching swaps the active engine, preserving position + play state.
  const transportRef = useRef(null);
  if (!transportRef.current) transportRef.current = createTransport();
  const transport = transportRef.current;
  const transportState = useTransport(transport);

  // Latest OSMD playback state (sheet seconds), fed by onPlaybackStateChange.
  const osmdSyncRef = useRef({ time: 0, playing: false, duration: 0, ready: false });
  // Latest iframe state message (midi seconds) + receive timestamp, so the
  // engine can interpolate between the iframe's 50ms state posts.
  const iframeSyncRef = useRef({ time: 0, at: 0, playing: false });
  // midiSec ↔ sheetSec mapping. Identity unless a sync map + sheet duration
  // are known (then it's the sync map composed with the sheet's timing).
  const mapperRef = useRef(createSheetSecMapper({}));
  const syncMapRef = useRef(preloadedSyncMap || null);
  const scoreHasOwnTimingRef = useRef(musicXmlHasVariableTempo(preloadedMusicXml));
  const sheetDurRef = useRef(0);
  const midiDurRef = useRef(0);
  const rateRef = useRef(1);
  // Set when the OSMD engine is told to seek/play before OSMD is ready
  // (e.g. right after remounting the sheet tab); applied on first OSMD tick.
  const pendingOsmdSyncRef = useRef(false);
  // After commanding OSMD to seek, its timing source reports stale time for a
  // few frames. Until OSMD's clock lands near the target (or the window
  // expires), the engine's readTime() returns null so the transport
  // self-advances instead of snapping back to the stale value.
  const osmdExpectRef = useRef(null); // { sheetSec, until } | null

  const isDemoMode = Boolean(preloadedMusicXml || preloadedMidiBuffer);
  const isTranscriptionInstrument = isDemoMode || TRANSCRIPTION_INSTRUMENTS.includes(selectedInstrument);
  const midiKey = MIDI_KEY_BY_INSTRUMENT[selectedInstrument];
  const musicXmlKey = MUSICXML_KEY_BY_INSTRUMENT[selectedInstrument];
  const syncMapKey = SYNC_MAP_KEY_BY_INSTRUMENT[selectedInstrument];

  const rebuildMapper = useCallback(() => {
    mapperRef.current = createSheetSecMapper({
      pairs: syncMapRef.current?.pairs,
      sheetDurationSec: sheetDurRef.current,
      preferIdentity: scoreHasOwnTimingRef.current,
    });
  }, []);

  useEffect(() => {
    syncMapRef.current = preloadedSyncMap || null;
    rebuildMapper();
  }, [preloadedSyncMap, rebuildMapper]);

  // Fetch the per-instrument sync map when the chain emits one (currently
  // drums only — SYNC_MAP_KEY_BY_INSTRUMENT). Best-effort: a missing or
  // invalid map leaves the identity mapping in place, so the OSMD cursor
  // simply follows the score's own timing. Instruments without a sync map
  // key skip this entirely.
  useEffect(() => {
    if (isDemoMode || !workflowId || !syncMapKey) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const prefetched = prefetchedFiles?.[syncMapKey];
        let text;
        if (prefetched?.blob) {
          text = await prefetched.blob.text();
        } else {
          const result = await downloadWorkflowFile(config.apiBaseUrl, workflowId, syncMapKey, getToken);
          text = result ? await result.blob.text() : null;
        }
        if (cancelled || !text) return;
        const map = parseSyncMap(text);
        if (cancelled) return;
        syncMapRef.current = map;
        rebuildMapper();
      } catch (err) {
        // Degrade gracefully — no sync map, cursor uses OSMD default timing.
        console.warn('Preview sync map unavailable:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [workflowId, syncMapKey, prefetchedFiles, getToken, isDemoMode, rebuildMapper]);

  useEffect(() => {
    if (isDemoMode) {
      scoreHasOwnTimingRef.current = musicXmlHasVariableTempo(preloadedMusicXml);
      setMusicXmlText(preloadedMusicXml || null);
      setXmlLoading(false);
      return undefined;
    }
    if (!workflowId || !isTranscriptionInstrument) {
      setXmlLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        setXmlLoading(true);
        setXmlError(null);
        const prefetched = prefetchedFiles?.[musicXmlKey] || prefetchedFiles?.musicxml;
        let text;
        if (prefetched?.blob) {
          text = await prefetched.blob.text();
        } else if (musicXmlKey) {
          text = await fetchMusicXmlText(config.apiBaseUrl, workflowId, getToken, musicXmlKey);
        } else {
          text = await fetchMusicXmlText(config.apiBaseUrl, workflowId, getToken);
        }
        if (!cancelled) {
          scoreHasOwnTimingRef.current = musicXmlHasVariableTempo(text);
          rebuildMapper();
          setMusicXmlText(text);
        }
      } catch (err) {
        if (!cancelled) setXmlError(err.message || 'Failed to load score');
      } finally {
        if (!cancelled) setXmlLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workflowId, isTranscriptionInstrument, prefetchedFiles, getToken, isDemoMode, preloadedMusicXml, musicXmlKey, rebuildMapper]);

  useEffect(() => {
    if (isDemoMode) {
      setMidiBuffer(preloadedMidiBuffer || null);
      return undefined;
    }
    if (!workflowId || !midiKey || midiBuffer) return undefined;
    let cancelled = false;
    (async () => {
      try {
        setMidiLoading(true);
        setMidiError(null);
        const prefetched = prefetchedFiles?.[midiKey];
        let buffer;
        if (prefetched?.blob) {
          buffer = await prefetched.blob.arrayBuffer();
        } else {
          buffer = await fetchMidiArrayBuffer(config.apiBaseUrl, workflowId, midiKey, getToken);
        }
        if (cancelled || !buffer) return;
        // Only preview (PRV*) jobs are capped at 10 seconds; full workflows
        // must show the entire song (the sheet tab already does).
        if (workflowId.startsWith('PRV')) {
          const truncated = truncateMidiToSeconds(buffer, 10);
          setMidiBuffer(truncated || buffer);
        } else {
          setMidiBuffer(buffer);
        }
      } catch (err) {
        if (!cancelled) setMidiError(err.message || 'Failed to load MIDI');
      } finally {
        if (!cancelled) setMidiLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workflowId, midiKey, midiBuffer, prefetchedFiles, getToken, isDemoMode, preloadedMidiBuffer]);

  useEffect(() => {
    if (!midiBuffer) return undefined;
    const blob = new Blob([midiBuffer], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    setIframeUrl(`${process.env.PUBLIC_URL || ''}/3d-piano-player/index.html?midiUrl=${encodeURIComponent(url)}`);
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    };
  }, [midiBuffer]);

  const postToIframe = useCallback((msg) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ source: 'gs', ...msg }, '*');
  }, []);

  // Serialized command queue for OSMD. PlaybackManager.playFromMs() (behind
  // OSMDViewer.seekMs) starts with `await pause()`, so an un-awaited play()
  // issued right after a seek races it and restarts playback from 0. Every
  // seek/play pair must therefore be awaited in sequence.
  const osmdQueueRef = useRef(Promise.resolve());
  // Command OSMD to seek (and optionally resume at) a sheet-seconds position,
  // opening a settle window during which its stale clock is ignored.
  const commandOsmd = useCallback((sheetSec, andPlay) => {
    // Open the settle window SYNCHRONOUSLY — before the transport's next rAF
    // tick can read OSMD's stale clock and snap the position back.
    osmdExpectRef.current = { sheetSec, until: nowMs() + 2000 };
    osmdQueueRef.current = osmdQueueRef.current
      .then(async () => {
        const osmd = osmdRef.current;
        if (!osmd) return;
        osmdExpectRef.current = { sheetSec, until: nowMs() + 2000 };
        try { await osmd.seekMs?.(sheetSec * 1000); } catch (e) {}
        // Re-check at execution time: the user may have paused or switched
        // tabs while this command sat in the queue.
        const t = transportRef.current;
        if (andPlay && t.getState().isPlaying && t.getActiveEngineId() === 'osmd') {
          try { await osmd.play?.(); } catch (e) {}
        }
      })
      .catch(() => {});
  }, []);

  // --- engines -------------------------------------------------------------
  useEffect(() => {
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
        try { osmdRef.current?.pause?.(); } catch (e) {}
      },
      seek: (sec) => {
        if (!osmdRef.current || !osmdSyncRef.current.ready) {
          pendingOsmdSyncRef.current = true;
          return;
        }
        // Engine contract: seek preserves play state. OSMD's playFromMs
        // pauses internally, so resume when the transport is playing.
        commandOsmd(mapperRef.current.midiSecToSheetSec(sec), t.getState().isPlaying);
      },
      readTime: () => {
        const s = osmdSyncRef.current;
        if (!s.ready) return null;
        const eff = s.time;
        const expect = osmdExpectRef.current;
        if (expect) {
          const settled = Math.abs(eff - expect.sheetSec) <= 0.75;
          if (!settled && nowMs() < expect.until) return null; // stale clock — self-advance
          osmdExpectRef.current = null;
        }
        return mapperRef.current.sheetSecToMidiSec(eff);
      },
    });
    t.attachEngine({
      id: 'midi',
      play: (atSec) => {
        postToIframe({ type: 'seek', seconds: atSec });
        postToIframe({ type: 'play' });
      },
      pause: () => postToIframe({ type: 'pause' }),
      seek: (sec) => postToIframe({ type: 'seek', seconds: sec }),
      readTime: () => {
        const s = iframeSyncRef.current;
        if (!s.at) return null;
        if (!s.playing) return s.time;
        // The iframe posts state every 50ms; interpolate between posts.
        return s.time + ((nowMs() - s.at) / 1000) * rateRef.current;
      },
    });
    // Detach (not dispose) so React StrictMode's dev double-invoke of effects
    // can re-attach to the same long-lived transport instance.
    return () => {
      t.pause();
      t.detachEngine('osmd');
      t.detachEngine('midi');
    };
  }, [postToIframe, commandOsmd]);

  // Active engine follows the visible tab. setActiveEngine pauses the old
  // engine, seeks the new one to the shared position, and resumes if playing.
  useEffect(() => {
    const t = transportRef.current;
    if (activeTab === 'music_sheet') {
      // The sheet tab remounts OSMD; mark it not-ready until its first tick
      // and re-sync (seek + optional play) once it reports in.
      osmdSyncRef.current = { ...osmdSyncRef.current, ready: false };
      pendingOsmdSyncRef.current = true;
      t.setActiveEngine('osmd');
    } else {
      osmdSyncRef.current = { ...osmdSyncRef.current, ready: false };
      t.setActiveEngine('midi');
    }
  }, [activeTab]);

  // Cross-drive: whenever the transport moves and OSMD is mounted but NOT the
  // active engine, follow with the sheet cursor (midi sec → sheet sec). The
  // piano-roll playhead follows the sheet automatically because it renders
  // from transport position.
  useEffect(() => {
    const t = transportRef.current;
    return t.subscribe((st) => {
      if (t.getActiveEngineId() === 'osmd') return;
      const osmd = osmdRef.current;
      if (!osmd) return;
      try { osmd.syncCursorToTime?.(mapperRef.current.midiSecToSheetSec(st.positionSec)); } catch (e) {}
    });
  }, []);

  // --- iframe state messages ------------------------------------------------
  useEffect(() => {
    const onMessage = (ev) => {
      const m = ev.data;
      if (!m || m.source !== 'gs') return;
      const t = transportRef.current;
      if (m.type !== 'state' && m.type !== 'loaded') return;
      const time = Number(m.currentTime) || 0;
      const duration = Number(m.duration) || 0;
      if (m.type === 'state') {
        iframeSyncRef.current = { time, at: nowMs(), playing: Boolean(m.isPlaying) };
      }
      // MIDI duration is the transport's source of truth for durationSec.
      if (duration > 0 && midiDurRef.current !== duration) {
        midiDurRef.current = duration;
        t.setDuration(duration);
      }
      // Reconcile: the iframe player stops itself at the end of the file.
      if (m.type === 'state' && t.getActiveEngineId() === 'midi') {
        const st = t.getState();
        if (st.isPlaying && !m.isPlaying && duration > 0 && time >= duration - 0.25) {
          t.pause();
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // --- OSMD state (sheet seconds, every animation frame while mounted) -----
  const handleOsmdStateChange = useCallback((s) => {
    const t = transportRef.current;
    // While a deferred sync is pending the OSMD clock is definitely stale —
    // keep ready=false so the transport self-advances rather than adopting it.
    osmdSyncRef.current = {
      time: s.currentTime,
      playing: s.isPlaying,
      duration: s.duration,
      ready: !pendingOsmdSyncRef.current,
    };
    // OSMDViewer reports an absolute natural-score position and duration.
    if (s.duration > 0 && !sheetDurRef.current) {
      sheetDurRef.current = s.duration;
      rebuildMapper();
      // No MIDI duration yet (iframe still loading)? Use the sheet's.
      if (!midiDurRef.current) {
        t.setDuration(mapperRef.current.sheetSecToMidiSec(sheetDurRef.current));
      }
    }
    // Deferred engine sync: OSMD just became ready after a tab switch/remount.
    if (pendingOsmdSyncRef.current && osmdRef.current && t.getActiveEngineId() === 'osmd') {
      pendingOsmdSyncRef.current = false;
      const st = t.getState();
      commandOsmd(mapperRef.current.midiSecToSheetSec(st.positionSec), st.isPlaying);
    }
    // Reconcile: OSMD pauses itself at the end of the sheet.
    if (t.getActiveEngineId() === 'osmd' && osmdSyncRef.current.ready) {
      const st = t.getState();
      const naturalDur = sheetDurRef.current;
      if (
        st.isPlaying && !s.isPlaying && naturalDur > 0 &&
        s.currentTime >= naturalDur - 0.05 && st.positionSec > 0.5
      ) {
        t.pause();
      }
    }
  }, [rebuildMapper, commandOsmd]);

  // --- UI handlers ----------------------------------------------------------
  const handleTogglePlay = useCallback(() => {
    const t = transportRef.current;
    if (t.getState().isPlaying) t.pause();
    else {
      const st = t.getState();
      if (st.durationSec > 0 && st.positionSec >= st.durationSec) t.seek(0);
      t.play();
    }
  }, []);

  const handleSkipBack = useCallback(() => {
    transportRef.current.seek(0);
  }, []);

  const handlePlayNote = useCallback(({ note, velocity, duration: dur }) => {
    postToIframe({ type: 'noteOn', note, velocity, duration: dur });
  }, [postToIframe]);

  const handleChangeSpeed = useCallback((newSpeed) => {
    setSpeed(newSpeed);
    const osmd = osmdRef.current;
    rateRef.current = newSpeed;
    transportRef.current.setRate(newSpeed);
    if (osmd?.setSpeed) { try { osmd.setSpeed(newSpeed); } catch (e) {} }
    postToIframe({ type: 'speed', factor: newSpeed });
  }, [postToIframe]);

  const handleToggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.();
    }
  }, []);

  const iframeClassName = useMemo(
    () => `piano-3d-iframe ${activeTab === 'piano_3d' ? '' : 'piano-3d-iframe-hidden'}`,
    [activeTab]
  );

  if (!isTranscriptionInstrument) {
    return null;
  }

  return (
    <div ref={containerRef} className="preview-panel">
      <div className="preview-panel-header">
        <PreviewTabs active={activeTab} onChange={setActiveTab} />
        <PreviewControls
          theme={theme}
          onToggleTheme={handleToggleTheme}
          zoom={zoom}
          onCycleZoom={setZoom}
          onToggleFullscreen={handleToggleFullscreen}
        />
      </div>
      <div className={`preview-viewer theme-${theme}`}>
        <Suspense fallback={<div className="preview-loading"><SkeletonPanel count={1} height={200} /></div>}>
          {activeTab === 'music_sheet' && (
            <MusicSheetTab
              ref={osmdRef}
              musicXmlText={musicXmlText}
              theme={theme}
              zoom={zoom}
              isLoading={xmlLoading}
              error={xmlError}
              onPlayNote={handlePlayNote}
              onPlaybackStateChange={handleOsmdStateChange}
            />
          )}
          {activeTab === 'piano_roll' && (
            <PianoRollTab
              midiBuffer={midiBuffer}
              isLoading={midiLoading}
              error={midiError}
              transport={transport}
            />
          )}
        </Suspense>
        <div className={`piano-3d-tab ${activeTab === 'piano_3d' ? '' : 'piano-3d-tab-hidden'}`}>
          {midiLoading && <div className="preview-loading"><SkeletonPanel count={1} height={200} /></div>}
          {midiError && <StatusMessage variant="error">{midiError}</StatusMessage>}
          {iframeUrl && (
            <iframe
              ref={iframeRef}
              title="3D Piano Player"
              src={iframeUrl}
              className={iframeClassName}
              allow="autoplay"
            />
          )}
        </div>
      </div>
      <PreviewBottomBar
        currentTime={transportState.positionSec}
        duration={transportState.durationSec}
        isPlaying={transportState.isPlaying}
        onTogglePlay={handleTogglePlay}
        onSkipBack={handleSkipBack}
        speed={speed}
        onChangeSpeed={handleChangeSpeed}
        instrument={selectedInstrument}
      />
    </div>
  );
}
