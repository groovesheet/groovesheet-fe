import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from './layout/Header';
import Footer from './layout/Footer';
import Playbar from './song/Playbar';
import SongSidebar from './song/SongSidebar';
import { SheetView, PianoRollView, StemsView } from './song/Viewers';
import './Song.css';

function fmtTime(s) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  return `${String(m).padStart(2, '0')}:${ss}`;
}

// Map backend stem_name → display label + signature color (reuses Explore palette).
const STEM_LABELS = {
  drums: 'Drums',
  bass: 'Bass',
  vocals: 'Vocals',
  other: 'Other',
  piano: 'Piano',
  guitar: 'Guitar',
};
const STEM_COLORS = {
  drums: '#FF7BA9',
  bass: '#FFC857',
  vocals: '#7CC4FF',
  other: '#C9A0FF',
  piano: '#6B8AFF',
  guitar: '#84F2A6',
};
const STEM_ORDER = ['vocals', 'drums', 'bass', 'other', 'piano', 'guitar'];

function deriveStems(assets) {
  // Only opus stems are playable anonymously (BE refuses non-opus stream URLs).
  const opusStems = assets.filter(
    (a) => a.asset_type === 'stem' && a.format === 'opus' && a.stem_name,
  );
  const byName = new Map(opusStems.map((a) => [a.stem_name, a]));
  const order = STEM_ORDER.filter((n) => byName.has(n))
    .concat(Array.from(byName.keys()).filter((n) => !STEM_ORDER.includes(n)));
  return order.map((name) => ({
    assetId: byName.get(name).id,
    name,
    label: STEM_LABELS[name] || name[0].toUpperCase() + name.slice(1),
    color: STEM_COLORS[name] || '#8d8c8d',
  }));
}

function Song({ onLoginClick }) {
  const { trackId } = useParams();
  const [track, setTrack] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState('stems'); // default to the viewer that actually plays audio
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [volume, setVolume] = useState(78);
  const [muted, setMuted] = useState(false);
  const [tempo, setTempo] = useState(100); // % — UI-only; audio playback rate not yet wired
  const [transpose, setTranspose] = useState(0);
  const [stemState, setStemState] = useState({});

  // Fetch track + assets
  useEffect(() => {
    let cancelled = false;
    setTrack(null);
    setError(null);
    (async () => {
      try {
        const r = await fetch(`/api/library/tracks/${trackId}`);
        if (!r.ok) {
          throw new Error(r.status === 404 ? 'Track not found' : `Failed to load (${r.status})`);
        }
        const data = await r.json();
        if (!cancelled) setTrack(data);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load track');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  const stems = track ? deriveStems(track.assets || []) : [];

  // Initialize per-stem volume/mute/solo state once stems load.
  useEffect(() => {
    if (!stems.length) return;
    setStemState((s) => {
      if (Object.keys(s).length) return s; // already initialized
      const next = {};
      stems.forEach((st) => {
        next[st.name] = { mute: false, solo: false, volume: 75 };
      });
      return next;
    });
  }, [stems.length]);

  const onStemChange = useCallback(
    (name, patch) =>
      setStemState((s) => ({ ...s, [name]: { ...(s[name] || {}), ...patch } })),
    [],
  );

  // Master audio element drives the timeline. We synthesize timing off the
  // first stem; per-stem playback is delegated to <Stem> via the StemsView.
  const totalSec = track?.duration_sec || 0;
  const onSeekFraction = useCallback(
    (f) => {
      const clamped = Math.max(0, Math.min(1, f));
      setCurrentSec(clamped * totalSec);
    },
    [totalSec],
  );
  const onPlayPause = useCallback(() => setIsPlaying((p) => !p), []);

  return (
    <div className="song-page">
      <div className="dot-grid" />
      <Header onLoginClick={onLoginClick} />

      {error && (
        <main className="song-error">
          <h1>{error}</h1>
          <p>
            <Link to="/explore">Back to explore</Link>
          </p>
        </main>
      )}

      {!error && !track && (
        <main className="song-loading">
          <div className="song-spinner" />
          <p>Loading track…</p>
        </main>
      )}

      {!error && track && (
        <>
          <div className="song-breadcrumb">
            <Link to="/explore">Explore</Link>
            <span className="sep">/</span>
            <span className="muted">{track.artist}</span>
            <span className="sep">/</span>
            <span className="current">{track.title}</span>
          </div>

          <div className="song-shell">
            <div className="song-main">
              <Playbar
                isPlaying={isPlaying}
                onPlayPause={onPlayPause}
                currentSec={currentSec}
                totalSec={totalSec}
                tempo={tempo}
                onTempo={setTempo}
                transpose={transpose}
                onTranspose={(v) => setTranspose(Math.max(-12, Math.min(12, v)))}
                volume={volume}
                onVolume={setVolume}
                muted={muted}
                onMute={() => setMuted((m) => !m)}
                onSeekFraction={onSeekFraction}
                fmtTime={fmtTime}
              />

              <div className="song-viewer-toolbar">
                <div className="song-seg" role="tablist">
                  <button
                    className={view === 'sheet' ? 'on' : ''}
                    onClick={() => setView('sheet')}
                  >
                    Sheet music<span className="kbd">1</span>
                  </button>
                  <button
                    className={view === 'midi' ? 'on' : ''}
                    onClick={() => setView('midi')}
                  >
                    Piano roll<span className="kbd">2</span>
                  </button>
                  <button
                    className={view === 'stems' ? 'on' : ''}
                    onClick={() => setView('stems')}
                  >
                    Stems<span className="kbd">3</span>
                  </button>
                </div>
                <div className="song-viewer-info">
                  {view === 'stems' && (
                    <span>
                      {stems.length} isolated stems · drag the timeline to scrub
                    </span>
                  )}
                  {view === 'sheet' && (
                    <span>
                      Sheet music will appear here once a MusicXML asset is available.
                    </span>
                  )}
                  {view === 'midi' && <span>MIDI piano roll · {track.duration_sec}s</span>}
                </div>
              </div>

              <div className="song-viewer">
                {view === 'sheet' && <SheetView track={track} />}
                {view === 'midi' && <PianoRollView track={track} stems={stems} />}
                {view === 'stems' && (
                  <StemsView
                    stems={stems}
                    stemState={stemState}
                    onStemChange={onStemChange}
                    isPlaying={isPlaying}
                    currentSec={currentSec}
                    totalSec={totalSec}
                    volume={volume}
                    muted={muted}
                    onTimeUpdate={setCurrentSec}
                    onEnded={() => setIsPlaying(false)}
                    onSeekFraction={onSeekFraction}
                  />
                )}
              </div>
            </div>

            <aside className="song-rsidebar-col">
              <SongSidebar track={track} stems={stems} />
            </aside>
          </div>
        </>
      )}

      <Footer />
    </div>
  );
}

export default Song;
