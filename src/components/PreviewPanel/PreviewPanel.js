import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth';
import { fetchMidiArrayBuffer, fetchMusicXmlText } from '../../utils/api';
import config from '../../config';
import PreviewTabs from './PreviewTabs';
import PreviewControls from './PreviewControls';
import PreviewBottomBar from './PreviewBottomBar';
import { MIDI_KEY_BY_INSTRUMENT, MUSICXML_KEY_BY_INSTRUMENT, truncateMidiToSeconds } from './previewUtils';
import './PreviewPanel.css';

const MusicSheetTab = lazy(() => import('./tabs/MusicSheetTab'));
const PianoRollTab = lazy(() => import('./tabs/PianoRollTab'));

const TRANSCRIPTION_INSTRUMENTS = ['drums', 'piano', 'jazz_bass', 'bass'];

export default function PreviewPanel({
  workflowId,
  selectedInstrument,
  prefetchedFiles,
  preloadedMusicXml,
  preloadedMidiBuffer,
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
  const [iframeState, setIframeState] = useState({ isPlaying: false, currentTime: 0, duration: 0 });
  const [osmdState, setOsmdState] = useState({ isPlaying: false, currentTime: 0, duration: 0 });
  const [speed, setSpeed] = useState(1);
  const containerRef = useRef(null);
  const osmdRef = useRef(null);
  const iframeRef = useRef(null);
  const blobUrlRef = useRef(null);

  const isDemoMode = Boolean(preloadedMusicXml || preloadedMidiBuffer);
  const isTranscriptionInstrument = isDemoMode || TRANSCRIPTION_INSTRUMENTS.includes(selectedInstrument);
  const midiKey = MIDI_KEY_BY_INSTRUMENT[selectedInstrument];
  const musicXmlKey = MUSICXML_KEY_BY_INSTRUMENT[selectedInstrument];

  const engine = activeTab === 'music_sheet' ? 'osmd' : 'iframe';
  const playerState = engine === 'osmd' ? osmdState : iframeState;

  useEffect(() => {
    if (isDemoMode) {
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
        if (!cancelled) setMusicXmlText(text);
      } catch (err) {
        if (!cancelled) setXmlError(err.message || 'Failed to load score');
      } finally {
        if (!cancelled) setXmlLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workflowId, isTranscriptionInstrument, prefetchedFiles, getToken, isDemoMode, preloadedMusicXml, musicXmlKey]);

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
        const truncated = truncateMidiToSeconds(buffer, 10);
        setMidiBuffer(truncated || buffer);
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

  useEffect(() => {
    const onMessage = (ev) => {
      const m = ev.data;
      if (!m || m.source !== 'gs') return;
      if (m.type === 'state') {
        setIframeState({
          isPlaying: Boolean(m.isPlaying),
          currentTime: Number(m.currentTime) || 0,
          duration: Number(m.duration) || 0,
        });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const postToIframe = useCallback((msg) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ source: 'gs', ...msg }, '*');
  }, []);

  useEffect(() => {
    if (engine === 'osmd') {
      postToIframe({ type: 'pause' });
    } else if (osmdRef.current) {
      try { osmdRef.current.pause?.(); } catch (e) {}
    }
  }, [engine, postToIframe]);

  const handleTogglePlay = useCallback(async () => {
    if (engine === 'osmd') {
      const osmd = osmdRef.current;
      if (!osmd) return;
      if (osmdState.isPlaying) await osmd.pause?.();
      else await osmd.play?.();
    } else {
      if (iframeState.isPlaying) postToIframe({ type: 'pause' });
      else postToIframe({ type: 'play' });
    }
  }, [engine, osmdState.isPlaying, iframeState.isPlaying, postToIframe]);

  const handleSkipBack = useCallback(async () => {
    if (engine === 'osmd') {
      const osmd = osmdRef.current;
      if (osmd) await osmd.seekMs?.(0);
    } else {
      postToIframe({ type: 'seek', seconds: 0 });
    }
  }, [engine, postToIframe]);

  const handlePlayNote = useCallback(({ note, velocity, duration: dur }) => {
    postToIframe({ type: 'noteOn', note, velocity, duration: dur });
  }, [postToIframe]);

  const handleChangeSpeed = useCallback((newSpeed) => {
    setSpeed(newSpeed);
    const osmd = osmdRef.current;
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

  const handleOsmdStateChange = useCallback((s) => {
    setOsmdState(s);
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
        <Suspense fallback={<div className="preview-loading">Loading viewer…</div>}>
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
              currentTime={playerState.currentTime}
              isPlaying={playerState.isPlaying}
            />
          )}
        </Suspense>
        <div className={`piano-3d-tab ${activeTab === 'piano_3d' ? '' : 'piano-3d-tab-hidden'}`}>
          {midiLoading && <div className="preview-loading">Loading MIDI…</div>}
          {midiError && <div className="preview-error">{midiError}</div>}
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
        currentTime={playerState.currentTime}
        duration={playerState.duration}
        isPlaying={playerState.isPlaying}
        onTogglePlay={handleTogglePlay}
        onSkipBack={handleSkipBack}
        speed={speed}
        onChangeSpeed={handleChangeSpeed}
      />
    </div>
  );
}
