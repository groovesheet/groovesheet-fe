import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth';
import { fetchMidiArrayBuffer, fetchMusicXmlText } from '../../utils/api';
import config from '../../config';
import PreviewTabs from './PreviewTabs';
import PreviewControls from './PreviewControls';
import { MIDI_KEY_BY_INSTRUMENT, truncateMidiToSeconds } from './previewUtils';
import './PreviewPanel.css';

const MusicSheetTab = lazy(() => import('./tabs/MusicSheetTab'));
const PianoRollTab = lazy(() => import('./tabs/PianoRollTab'));
const Piano3DTab = lazy(() => import('./tabs/Piano3DTab'));

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
  const containerRef = useRef(null);
  const osmdRef = useRef(null);

  const isDemoMode = Boolean(preloadedMusicXml || preloadedMidiBuffer);
  const isTranscriptionInstrument = isDemoMode || TRANSCRIPTION_INSTRUMENTS.includes(selectedInstrument);
  const midiKey = MIDI_KEY_BY_INSTRUMENT[selectedInstrument];

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
        const prefetched = prefetchedFiles?.musicxml;
        let text;
        if (prefetched?.blob) {
          text = await prefetched.blob.text();
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
  }, [workflowId, isTranscriptionInstrument, prefetchedFiles, getToken, isDemoMode, preloadedMusicXml]);

  useEffect(() => {
    if (isDemoMode) {
      setMidiBuffer(preloadedMidiBuffer || null);
      return undefined;
    }
    if (activeTab === 'music_sheet' || !workflowId || !midiKey || midiBuffer) return undefined;
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
  }, [activeTab, workflowId, midiKey, midiBuffer, prefetchedFiles, getToken, isDemoMode, preloadedMidiBuffer]);

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
            />
          )}
          {activeTab === 'piano_roll' && (
            <PianoRollTab
              midiBuffer={midiBuffer}
              isLoading={midiLoading}
              error={midiError}
            />
          )}
          {activeTab === 'piano_3d' && (
            <Piano3DTab
              midiBuffer={midiBuffer}
              isLoading={midiLoading}
              error={midiError}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}
