import React, { useEffect, useMemo, useState } from 'react';
import Video2 from './Video2';
import { orderSongIds, isBenchmark, BENCHMARK_BORDER } from './benchmarkSongs';

/**
 * Video2Instrument — shared frame for /video2forguitar and /video2forbass.
 *
 * Same pattern as Video2Drums: reads transcription-samples/_summary.json,
 * shows a song row + a worker-comparison row pinned bottom-center, and
 * remounts the Video2 frame per (song, worker). The instrument config
 * (kind filter, worker tabs, CTA) comes in via props so guitar and bass
 * are thin wrappers around the same component.
 */

const PUB = process.env.PUBLIC_URL || '';
const SAMPLES = `${PUB}/transcription-samples`;
const ICONS = `${PUB}/video-assets/icons`;

// display metadata for the benchmark songs (superset across instruments)
const SONGS = {
  'dont-stop-me-now': { title: "Don't Stop Me Now", artist: 'Queen', year: 1978 },
  'sweet-home-alabama': { title: 'Sweet Home Alabama', artist: 'Lynyrd Skynyrd', year: 1974 },
  'uptown-girl': { title: 'Uptown Girl', artist: 'Billy Joel', year: 1983 },
  'im-still-standing': { title: "I'm Still Standing", artist: 'Elton John', year: 1983 },
  'everybody-wants-to-rule-the-world': { title: 'Everybody Wants To Rule The World', artist: 'Tears For Fears', year: 1985 },
  'night-in-tunisia': { title: 'Night In Tunisia', artist: 'Jesús Molina', year: 2018 },
  'ado-mirror': { title: 'MIRROR', artist: 'Ado', year: 2024 },
  'cant-stop': { title: "Can't Stop", artist: 'Red Hot Chili Peppers', year: 2002 },
};

export default function Video2Instrument({ kind, workers, defaultWorkerId, ctaLabel, ctaIcon, rollVariant }) {
  const [summary, setSummary] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | empty
  const [songId, setSongId] = useState(null);
  const [workerId, setWorkerId] = useState(defaultWorkerId || (workers[0] && workers[0].id));

  useEffect(() => {
    fetch(`${SAMPLES}/_summary.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => { setSummary(data); setLoadState('ready'); })
      .catch(() => { setSummary(null); setLoadState('empty'); });
  }, []);

  // song -> worker -> { xmlUrl, midiUrl } from completed jobs of this kind
  const songs = useMemo(() => {
    const map = {};
    (summary || [])
      .filter((e) => e.kind === kind && e.status === 'completed' && (e.xml || e.midi))
      .forEach((e) => {
        map[e.song] = map[e.song] || {};
        map[e.song][e.worker] = {
          xmlUrl: e.xml ? `${SAMPLES}/${e.song}/${e.worker}/${encodeURIComponent(e.xml)}` : null,
          midiUrl: e.midi ? `${SAMPLES}/${e.song}/${e.worker}/${encodeURIComponent(e.midi)}` : null,
        };
      });
    return map;
  }, [summary, kind]);

  const songIds = orderSongIds(Object.keys(songs));
  useEffect(() => {
    if (songId == null && songIds.length) setSongId(songIds[0]);
  }, [songIds, songId]);

  const songWorkers = (songId && songs[songId]) || {};
  // if the selected worker has no output for this song, fall back to any that does
  const activeWorkerId = songWorkers[workerId]
    ? workerId
    : (workers.find((w) => songWorkers[w.id]) || {}).id;
  const active = activeWorkerId && songWorkers[activeWorkerId];
  const s = SONGS[songId] || { title: songId || '', artist: 'GrooveSheet', year: '' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      {active && (
        <Video2
          key={`${songId}|${activeWorkerId}`}
          xmlUrl={active.xmlUrl}
          midiUrl={active.midiUrl}
          kind={kind}
          rollVariant={rollVariant}
          metaOverride={{
            title: s.title,
            artist: s.artist,
            year: s.year,
            ctaLabel,
            ctaIcon,
          }}
        />
      )}

      {!active && (
        <div style={emptyHint}>
          {loadState === 'loading'
            ? 'loading transcriptions…'
            : `No completed ${kind} transcriptions found in transcription-samples/_summary.json.`}
        </div>
      )}

      {/* song + worker picker — pinned bottom-center */}
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
            {workers.map((w) => {
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

export function Video2Guitar() {
  return (
    <Video2Instrument
      kind="guitar"
      workers={[
        { id: 'transkun-guitar', label: 'transkun (polyphonic)' },
        { id: 'fcpe-guitar', label: 'fcpe (monophonic)' },
      ]}
      defaultWorkerId="transkun-guitar"
      ctaLabel="Guitar Transcription"
      ctaIcon={`${ICONS}/Guitar.svg`}
    />
  );
}

export function Video2Bass() {
  return (
    <Video2Instrument
      kind="bass"
      workers={[
        { id: 'bassunet-bass', label: 'bassunet' },
        { id: 'fcpe-bass', label: 'fcpe' },
      ]}
      defaultWorkerId="bassunet-bass"
      ctaLabel="Bass Transcription"
      ctaIcon={`${ICONS}/Bass.svg`}
    />
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
