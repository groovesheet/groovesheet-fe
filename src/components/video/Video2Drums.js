import React, { useEffect, useMemo, useState } from 'react';
import Video2 from './Video2';
import { orderSongIds, isBenchmark, BENCHMARK_BORDER } from './benchmarkSongs';

/**
 * Video2Drums — /video2fordrums: the drums cut of the Video2 frame.
 *
 * Same 3840x2160 frame as /video2, but drums-only and with the roll band
 * swapped for the top-down drum-kit visualiser (VideoDrumKit): the sheet from
 * the worker's MusicXML on top, the kit photo below with each piece flashing
 * on its hits. Songs come from the same transcription-samples/_summary.json
 * the /video2forpiano harness reads — any completed drums worker output shows
 * up here, with tabs to compare adtof vs adtof+ (7-voice) per song.
 */

const PUB = process.env.PUBLIC_URL || '';
const SAMPLES = `${PUB}/transcription-samples`;
const ICONS = `${PUB}/video-assets/icons`;

// display metadata for the test songs (matches Video2Tabs)
const SONGS = {
  'night-in-tunisia': { title: 'Night In Tunisia', artist: 'Jesús Molina', year: 2018 },
  'ado-mirror': { title: 'MIRROR', artist: 'Ado', year: 2024 },
  'cant-stop': { title: "Can't Stop", artist: 'Red Hot Chili Peppers', year: 2002 },
  'sweet-home-alabama': { title: 'Sweet Home Alabama', artist: 'Lynyrd Skynyrd', year: 1974 },
  'everybody-wants-to-rule-the-world': { title: 'Everybody Wants To Rule The World', artist: 'Tears For Fears', year: 1985 },
  'the-adults-are-talking': { title: 'The Adults Are Talking', artist: 'The Strokes', year: 2020 },
  'dont-stop-me-now': { title: "Don't Stop Me Now", artist: 'Queen', year: 1978 },
  'uptown-girl': { title: 'Uptown Girl', artist: 'Billy Joel', year: 1983 },
  'everybody-talks': { title: 'Everybody Talks', artist: 'Neon Trees', year: 2011 },
  'come-a-little-closer': { title: 'Come A Little Closer', artist: 'Cage The Elephant', year: 2013 },
  'tongue-tied': { title: 'Tongue Tied', artist: 'GROUPLOVE', year: 2011 },
  'starman': { title: 'Starman', artist: 'David Bowie', year: 1972 },
};

// drum workers to compare, in display order
const DRUM_WORKERS = [
  { id: 'adtof-drums', label: 'adtof' },
  { id: 'adtof-plus-drums', label: 'adtof+ 7-voice' },
  { id: 'quantized-drums', label: 'adtof+ beat-tracked' },
];

export default function Video2Drums() {
  const [summary, setSummary] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | empty
  const [songId, setSongId] = useState(null);
  const [workerId, setWorkerId] = useState('adtof-plus-drums');

  useEffect(() => {
    fetch(`${SAMPLES}/_summary.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => { setSummary(data); setLoadState('ready'); })
      .catch(() => { setSummary(null); setLoadState('empty'); });
  }, []);

  // song -> worker -> { xmlUrl, midiUrl } from completed drums workers
  const drumSongs = useMemo(() => {
    const map = {};
    (summary || [])
      .filter((e) => e.kind === 'drums' && e.status === 'completed' && e.midi)
      .forEach((e) => {
        map[e.song] = map[e.song] || {};
        map[e.song][e.worker] = {
          xmlUrl: e.xml ? `${SAMPLES}/${e.song}/${e.worker}/${encodeURIComponent(e.xml)}` : null,
          midiUrl: `${SAMPLES}/${e.song}/${e.worker}/${encodeURIComponent(e.midi)}`,
        };
      });
    return map;
  }, [summary]);

  const songIds = orderSongIds(Object.keys(drumSongs));
  useEffect(() => {
    if (songId == null && songIds.length) setSongId(songIds[0]);
  }, [songIds, songId]);

  const songWorkers = (songId && drumSongs[songId]) || {};
  // if the selected worker has no output for this song, fall back to any that does
  const activeWorkerId = songWorkers[workerId]
    ? workerId
    : (DRUM_WORKERS.find((w) => songWorkers[w.id]) || {}).id;
  const active = activeWorkerId && songWorkers[activeWorkerId];
  const s = SONGS[songId] || { title: songId || 'Drums', artist: 'GrooveSheet', year: '' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      {active && (
        <Video2
          key={`${songId}|${activeWorkerId}`}
          xmlUrl={active.xmlUrl}
          midiUrl={active.midiUrl}
          kind="drums"
          rollVariant="kit"
          metaOverride={{
            title: s.title,
            artist: s.artist,
            year: s.year,
            ctaLabel: 'Drum Transcription',
            ctaIcon: `${ICONS}/Drums.svg`,
          }}
        />
      )}

      {!active && (
        <div style={emptyHint}>
          {loadState === 'loading'
            ? 'loading transcriptions…'
            : 'No completed drum transcriptions found in transcription-samples/_summary.json.'}
        </div>
      )}

      {/* song + worker picker — pinned bottom-center like the /video2forpiano tab bar */}
      {songIds.length > 0 && (
        <div style={barWrap}>
          <div style={rowWrap}>
            {songIds.map((sid) => (
              <button key={sid} onClick={() => setSongId(sid)} style={songBtn(sid === songId, isBenchmark(sid))}>
                {(SONGS[sid] && SONGS[sid].title) || sid}
              </button>
            ))}
          </div>
          <div style={{ height: 1, alignSelf: 'stretch', background: '#333', margin: '2px 0' }} />
          <div style={rowWrap}>
            {DRUM_WORKERS.map((w) => {
              const enabled = !!songWorkers[w.id];
              return (
                <button
                  key={w.id}
                  disabled={!enabled}
                  onClick={() => enabled && setWorkerId(w.id)}
                  title={enabled ? '' : 'not transcribed yet'}
                  style={{ ...songBtn(w.id === activeWorkerId), cursor: enabled ? 'pointer' : 'not-allowed', opacity: enabled ? 1 : 0.5 }}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const barWrap = {
  position: 'fixed',
  bottom: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  maxWidth: 'calc(100vw - 24px)',
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

const emptyHint = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  color: '#ccc',
  fontSize: 14,
  textAlign: 'center',
  maxWidth: 520,
};

function songBtn(active, special) {
  return {
    flexShrink: 0,
    whiteSpace: 'nowrap',
    padding: '7px 12px',
    borderRadius: 9,
    border: `1px solid ${active ? '#012FA7' : special ? BENCHMARK_BORDER : '#3a3a3d'}`,
    background: active ? '#012FA7' : '#222',
    color: '#fff',
    fontSize: 13,
    cursor: 'pointer',
  };
}
