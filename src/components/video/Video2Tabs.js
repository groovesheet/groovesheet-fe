import React, { useEffect, useMemo, useState } from 'react';
import Video2 from './Video2';

/**
 * Video2Tabs — quality-comparison harness for the transcription workers.
 *
 * Renders the Video2 animated frame, but lets you switch between the MusicXML
 * produced by each transcription worker (transkun=piano, adtof=drums,
 * bassunet=bass, fcpe=bass) for each test song. The per-worker outputs are
 * produced by groovesheet-be/development-related/local-tools/run_transcription_test.py
 * and land under public/transcription-samples/<song>/<worker>/. That script also
 * writes _summary.json, which this component reads to discover what's available.
 *
 * Until the cloud jobs finish (or if the summary is missing) it falls back to
 * the bundled piano sample so /video2 still renders.
 */

const PUB = process.env.PUBLIC_URL || '';
const SAMPLES = `${PUB}/transcription-samples`;
const ICONS = `${PUB}/video-assets/icons`;
const SAMPLE_XML = `${PUB}/sample-preview/sample.musicxml`;
// guitar demo reuses the bundled piano MIDI; notes outside guitar range are
// skipped by the fretboard placement, the rest land on the neck.
const SAMPLE_GUITAR_MIDI = `${PUB}/sample-preview/sample.mid`;

// one tab per worker (user choice: compare engines directly)
const WORKERS = [
  { id: 'transkun-piano', kind: 'piano', label: 'Piano', sub: 'transkun-v2', cta: 'Keyboard Transcription', icon: `${ICONS}/Keyboard.svg` },
  { id: 'transkun-piano-split', kind: 'piano', label: 'Piano', sub: 'raw + grand staff', cta: 'Keyboard Transcription', icon: `${ICONS}/Keyboard.svg` },
  { id: 'transkun-piano-quantized-before', kind: 'piano', label: 'Piano', sub: 'midi2score ✗ before', cta: 'Keyboard Transcription', icon: `${ICONS}/Keyboard.svg` },
  { id: 'transkun-piano-quantized', kind: 'piano', label: 'Piano', sub: 'midi2score ✓ after', cta: 'Keyboard Transcription', icon: `${ICONS}/Keyboard.svg` },
  { id: 'adtof-drums', kind: 'drums', label: 'Drums', sub: 'adtof', cta: 'Drum Transcription', icon: `${ICONS}/Drums.svg` },
  { id: 'adtof-plus-drums', kind: 'drums', label: 'Drums', sub: 'adtof+ 7-voice', cta: 'Drum Transcription', icon: `${ICONS}/Drums.svg` },
  { id: 'bassunet-bass', kind: 'bass', label: 'Bass', sub: 'bassunet', cta: 'Bass Transcription', icon: `${ICONS}/Bass.svg` },
  { id: 'fcpe-bass', kind: 'bass', label: 'Bass', sub: 'fcpe', cta: 'Bass Transcription', icon: `${ICONS}/Bass.svg` },
  { id: 'guitar', kind: 'guitar', label: 'Guitar', sub: 'falling fretboard', cta: 'Guitar Transcription', icon: `${ICONS}/Guitar.svg` },
];

// Guitar has no transcription worker yet, so the tab always renders a bundled
// guitar MIDI on the fretboard visualiser. Once a real guitar worker writes to
// transcription-samples/<song>/guitar/ (kind: 'guitar'), summary discovery below
// picks it up automatically and overrides this.
const GUITAR_SAMPLE = {
  xmlUrl: null,
  midiUrl: SAMPLE_GUITAR_MIDI,
  kind: 'guitar',
};

// display metadata for the test songs (cover art falls back to the default)
const SONGS = {
  'night-in-tunisia': { title: 'Night In Tunisia', artist: 'Jesús Molina', year: 2018 },
  'ado-mirror': { title: 'MIRROR', artist: 'Ado', year: 2024 },
  'piano-idea-10': { title: 'Idea 10', artist: 'Gibran Alcocer', year: 2022 },
  'turkish-march': { title: 'Turkish March', artist: 'Mozart', year: 1783 },
  'piano-man': { title: 'Piano Man', artist: 'Billy Joel', year: 1973 },
  'im-still-standing': { title: "I'm Still Standing", artist: 'Elton John', year: 1983 },
  'vienna': { title: 'Vienna', artist: 'Billy Joel', year: 1977 },
  'dont-stop-me-now': { title: "Don't Stop Me Now", artist: 'Queen', year: 1978 },
  'cant-stop': { title: "Can't Stop", artist: 'Red Hot Chili Peppers', year: 2002 },
  // video2_piano pipeline runs (shipped artifacts — debugging the live render bugs)
  'wonderwall': { title: 'Wonderwall', artist: 'Oasis', year: 1995 },
  'wake-me-up-september-ends': { title: 'Wake Me Up When September Ends', artist: 'Green Day', year: 2004 },
  'last-night-on-earth': { title: 'Last Night on Earth', artist: 'Green Day', year: 2009 },
  'bring-me-to-life': { title: 'Bring Me to Life', artist: 'Evanescence', year: 2003 },
  'iris': { title: 'Iris', artist: 'Goo Goo Dolls', year: 1998 },
  'creep': { title: 'Creep', artist: 'Radiohead', year: 1992 },
};

const SAMPLE_FALLBACK = {
  key: '__sample__',
  songId: '__sample__',
  workerId: 'transkun-piano-quantized',
  xmlUrl: SAMPLE_XML,
  midiUrl: null,
  kind: 'piano',
  meta: { title: 'Sample (bundled)', artist: 'GrooveSheet', ctaLabel: 'Keyboard Transcription', ctaIcon: `${ICONS}/Keyboard.svg` },
};

export default function Video2Tabs() {
  const [summary, setSummary] = useState(null); // raw array | null
  const [loadState, setLoadState] = useState('loading'); // loading | ready | empty
  const [songId, setSongId] = useState(null);
  const [workerId, setWorkerId] = useState('transkun-piano-quantized');

  const loadSummary = React.useCallback(() => {
    setLoadState('loading');
    fetch(`${SAMPLES}/_summary.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        setSummary(data);
        setLoadState('ready');
      })
      .catch(() => {
        setSummary(null);
        setLoadState('empty');
      });
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  // song -> worker -> { xmlUrl, midiUrl, kind }, from completed jobs only.
  // A worker is renderable if it produced a sheet (xml) OR roll/audio (midi).
  const available = useMemo(() => {
    const map = {};
    const url = (song, worker, file) =>
      file ? `${SAMPLES}/${song}/${worker}/${encodeURIComponent(file)}` : null;
    (summary || [])
      .filter((e) => e.status === 'completed' && (e.xml || e.midi))
      .forEach((e) => {
        map[e.song] = map[e.song] || {};
        map[e.song][e.worker] = {
          xmlUrl: url(e.song, e.worker, e.xml),
          midiUrl: url(e.song, e.worker, e.midi),
          kind: e.kind || 'piano',
        };
      });
    return map;
  }, [summary]);

  const songIds = Object.keys(available);

  // pick a sensible default song once data lands
  useEffect(() => {
    if (songId == null && songIds.length) setSongId(songIds[0]);
  }, [songIds, songId]);

  // build the active frame: real output if present, else sample fallback
  const active = useMemo(() => {
    let src = songId && available[songId] && available[songId][workerId];
    // guitar tab: fall back to the bundled fretboard demo when no worker output.
    if (!src && workerId === 'guitar') src = GUITAR_SAMPLE;
    if (!src) return SAMPLE_FALLBACK;
    const w = WORKERS.find((x) => x.id === workerId) || WORKERS[0];
    const s = SONGS[songId] || { title: songId || 'Guitar Sample', artist: 'GrooveSheet', year: '' };
    return {
      key: `${songId}|${workerId}`,
      songId,
      workerId,
      xmlUrl: src.xmlUrl,
      midiUrl: src.midiUrl,
      kind: src.kind || w.kind,
      meta: { title: s.title, artist: s.artist, year: s.year, ctaLabel: w.cta, ctaIcon: w.icon },
    };
  }, [songId, workerId, available]);

  // guitar always renders (bundled fretboard demo); other workers need real output.
  const hasWorker = (wid) => wid === 'guitar' || !!(songId && available[songId] && available[songId][wid]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      {/* the rendered Video2 frame; remount per (song,worker) to reset OSMD cleanly */}
      <Video2
        key={active.key}
        xmlUrl={active.xmlUrl}
        midiUrl={active.midiUrl}
        kind={active.kind}
        metaOverride={active.meta}
      />

      {/* tab bar — pinned bottom-center, above the frame controls (which are top-left) */}
      <div style={barWrap}>
        {/* row 1: song selector */}
        <div style={rowWrap}>
          {songIds.length === 0 && (
            <span style={{ color: '#bbb', fontSize: 12, alignSelf: 'center' }}>
              {loadState === 'loading' ? 'loading…' : 'no transcriptions yet'}
            </span>
          )}
          {songIds.map((sid) => (
            <button key={sid} onClick={() => setSongId(sid)} style={songBtn(sid === songId)}>
              {(SONGS[sid] && SONGS[sid].title) || sid}
            </button>
          ))}
        </div>

        {/* divider between the two stacked rows */}
        <div style={{ height: 1, alignSelf: 'stretch', background: '#333', margin: '2px 0' }} />

        {/* row 2: worker tabs + reload */}
        <div style={rowWrap}>
          {WORKERS.map((w) => {
            const enabled = hasWorker(w.id);
            const isActive = w.id === workerId && enabled;
            return (
              <button
                key={w.id}
                disabled={!enabled}
                onClick={() => enabled && setWorkerId(w.id)}
                title={enabled ? '' : 'not transcribed yet'}
                style={tabBtn(isActive, enabled)}
              >
                <img src={w.icon} alt="" style={{ height: 16, filter: 'brightness(0) invert(1)', opacity: enabled ? 1 : 0.4 }} />
                <span>{w.label}</span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>{w.sub}</span>
              </button>
            );
          })}
          <button onClick={loadSummary} style={songBtn(false)} title="re-read _summary.json">↻</button>
        </div>
      </div>

      {loadState === 'empty' && (
        <div style={hint}>
          Showing the bundled piano sample. Worker outputs appear here once
          run_transcription_test.py finishes and writes
          <code style={{ color: '#9cf' }}> public/transcription-samples/_summary.json</code> — hit ↻ to refresh.
        </div>
      )}
    </div>
  );
}

const barWrap = {
  position: 'fixed',
  bottom: 16,
  left: 12,
  right: 12,
  zIndex: 20,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  background: 'rgba(20,20,22,0.92)',
  border: '1px solid #333',
  borderRadius: 12,
  backdropFilter: 'blur(6px)',
};

const rowWrap = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
};

const hint = {
  position: 'fixed',
  top: 56,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 20,
  maxWidth: 680,
  textAlign: 'center',
  color: '#ccc',
  fontSize: 12,
  lineHeight: '18px',
  background: 'rgba(20,20,22,0.9)',
  border: '1px solid #333',
  borderRadius: 10,
  padding: '8px 14px',
};

function tabBtn(active, enabled) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    padding: '7px 12px',
    borderRadius: 9,
    border: `1px solid ${active ? '#012FA7' : '#3a3a3d'}`,
    background: active ? '#012FA7' : '#222',
    color: '#fff',
    fontSize: 13,
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.5,
  };
}

function songBtn(active) {
  return {
    flexShrink: 0,
    whiteSpace: 'nowrap',
    padding: '7px 12px',
    borderRadius: 9,
    border: `1px solid ${active ? '#012FA7' : '#3a3a3d'}`,
    background: active ? '#012FA7' : '#222',
    color: '#fff',
    fontSize: 13,
    cursor: 'pointer',
  };
}
