// Song detail page — composition for /explore/:songId.
// Ported from the Anthropic design pack (song-app.jsx). Theme is driven by the
// app-wide ThemeContext; nav/footer reuse the shared layout components.
import React, { useCallback, useEffect, useState } from 'react';
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
import { SONG, RELATED } from '../../mocks/songDetailData';
import './Song.css';

function Breadcrumb({ song, navigate }) {
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
      <a href="#" onClick={(e) => e.preventDefault()}>
        {song.artist}
      </a>
      <span className="sep">/</span>
      <span className="current">{song.title}</span>
    </div>
  );
}

function ViewerToolbar({ viewMode, onView, viewerInfo }) {
  return (
    <div className="gs-viewer-toolbar">
      <div className="gs-seg" role="tablist">
        <button className={viewMode === 'sheet' ? 'on' : ''} onClick={() => onView('sheet')}>
          <Icon.Sheet />
          <span>Sheet music</span>
          <span className="gs-seg-kbd">1</span>
        </button>
        <button className={viewMode === 'midi' ? 'on' : ''} onClick={() => onView('midi')}>
          <Icon.Midi />
          <span>Piano roll</span>
          <span className="gs-seg-kbd">2</span>
        </button>
        <button className={viewMode === 'stems' ? 'on' : ''} onClick={() => onView('stems')}>
          <Icon.Stems />
          <span>Stems</span>
          <span className="gs-seg-kbd">3</span>
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{viewerInfo}</div>
    </div>
  );
}

function SongDetail({ onLoginClick }) {
  useParams(); // :songId — page renders the design mock for now (backend lands later)
  const navigate = useLocalizedNavigate();
  const { isDarkMode, toggleTheme } = useTheme();

  // Playback state
  const totalSec = SONG.durationSec;
  const totalBeats = SONG.measures * 4;
  const [posBeat, setPosBeat] = useState(36);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempoState] = useState(100);
  const [transpose, setTranspose] = useState(0);
  const [loopMode, setLoopMode] = useState('off'); // off | song | ab
  const [loopRegion] = useState({ startBeat: 80, endBeat: 116 });
  const [volume, setVolume] = useState(78);
  const [muted, setMuted] = useState(false);
  const [metronome, setMetronome] = useState(false);

  // Stem state
  const [stemState, setStemState] = useState(() => {
    const s = {};
    SONG.stems.forEach((st) => (s[st.name] = { mute: false, solo: false, volume: 75 }));
    return s;
  });

  // View mode + mobile drawer
  const [view, setView] = useState('sheet');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fake clock — advance posBeat while playing
  useEffect(() => {
    if (!isPlaying) return undefined;
    let raf;
    let last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      setPosBeat((p) => {
        const beatsPerSec = (SONG.tempo * (tempo / 100)) / 60;
        let np = p + beatsPerSec * dt;
        if (loopMode === 'ab' && np >= loopRegion.endBeat) np = loopRegion.startBeat;
        else if (loopMode === 'song' && np >= totalBeats) np = 0;
        else if (np >= totalBeats) {
          np = totalBeats;
          setIsPlaying(false);
        }
        return np;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, tempo, loopMode, loopRegion, totalBeats]);

  const currentSec = (posBeat / totalBeats) * totalSec;

  const onSeekFraction = useCallback(
    (f) => {
      setPosBeat(Math.max(0, Math.min(totalBeats, f * totalBeats)));
    },
    [totalBeats]
  );
  const onSeekMeasure = (m) => setPosBeat(m * 4);
  const onStemChange = (name, patch) => setStemState((s) => ({ ...s, [name]: { ...s[name], ...patch } }));
  const cycleLoop = () => setLoopMode((m) => (m === 'off' ? 'song' : m === 'song' ? 'ab' : 'off'));

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /(input|textarea|select)/i.test(e.target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
      if (e.key === '1') setView('sheet');
      if (e.key === '2') setView('midi');
      if (e.key === '3') setView('stems');
      if (e.key === 'l' || e.key === 'L') cycleLoop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const goToSong = (s) => navigate(`/explore/${s.id}`);

  const viewerInfo =
    view === 'sheet' ? (
      <span style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>
        Engraved with <strong style={{ color: 'var(--color-text)' }}>GrooveSheet OSMD</strong> · {SONG.pages} pages · {SONG.measures} bars
      </span>
    ) : view === 'midi' ? (
      <span style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>
        {SONG.parts}-track MIDI · {SONG.timeSig} · {SONG.key} · ♩ = {SONG.tempo}
      </span>
    ) : (
      <span style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>
        {SONG.stems.length} isolated stems · drag the timeline to scrub
      </span>
    );

  return (
    <div className="gs-song-page">
      {/* Dot grid */}
      <div className="gs-dotgrid" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <Header onLoginClick={onLoginClick} />
        <Breadcrumb song={SONG} navigate={navigate} />

        <div className="gs-song-shell">
          {/* Main column */}
          <div style={{ minWidth: 0 }}>
            {/* Sticky header: playback bar + view switcher pinned together */}
            <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--color-tinted-background)', padding: 0 }}>
              <PlaybackBar
                song={SONG}
                isPlaying={isPlaying}
                onPlayPause={() => setIsPlaying((p) => !p)}
                currentSec={currentSec}
                totalSec={totalSec}
                tempo={tempo}
                onTempo={setTempoState}
                transpose={transpose}
                onTranspose={(v) => setTranspose(Math.max(-12, Math.min(12, v)))}
                loopMode={loopMode}
                onLoopMode={cycleLoop}
                loopRegion={loopMode === 'ab' ? loopRegion : null}
                volume={volume}
                onVolume={setVolume}
                muted={muted}
                onMute={() => setMuted((m) => !m)}
                metronome={metronome}
                onMetronome={() => setMetronome((m) => !m)}
                dark={isDarkMode}
                onToggleTheme={toggleTheme}
                onFullscreen={() => {
                  if (document.fullscreenElement) document.exitFullscreen();
                  else document.documentElement.requestFullscreen?.();
                }}
                onSeekFraction={onSeekFraction}
                totalBeats={totalBeats}
              />

              {/* Viewer toolbar */}
              <ViewerToolbar viewMode={view} onView={setView} viewerInfo={viewerInfo} />
            </div>

            {/* Viewer */}
            <div className="gs-viewer">
              {view === 'sheet' && (
                <SheetMusicView song={SONG} currentBeat={posBeat} totalBeats={totalBeats} measures={SONG.measures} transpose={transpose} onSeekMeasure={onSeekMeasure} />
              )}
              {view === 'midi' && <PianoRollView song={SONG} currentBeat={posBeat} totalBeats={totalBeats} measures={SONG.measures} onSeek={onSeekFraction} />}
              {view === 'stems' && <StemsView song={SONG} currentBeat={posBeat} totalBeats={totalBeats} stemState={stemState} onStemChange={onStemChange} onSeek={onSeekFraction} />}
            </div>

            {/* Below-viewer rows */}
            <CardRow title="Recommended scores" subtitle="Picked from your listening history and the people who downloaded this score." items={RELATED.recommended} variant="mix" onCardClick={goToSong} />
            <CardRow title="Other difficulties" subtitle="The same piece, transcribed at every level." items={RELATED.difficulties} variant="sheet" onCardClick={goToSong} />
            <CardRow title="Versions for other instruments" subtitle="Guitar, strings, brass — arranged by our editors." items={RELATED.arrangements} variant="sheet" onCardClick={goToSong} />
            <CardRow title={`Scores from ${SONG.artist}`} subtitle="Every Einaudi piece in the GrooveSheet library." items={RELATED.artist} variant="sheet" onCardClick={goToSong} />
            <CardRow title="Best of GrooveSheet" subtitle="Editorial picks — the most polished transcriptions on the platform." items={RELATED.bestOf} variant="mix" onCardClick={goToSong} />
            <CardRow title="Trending now" subtitle="What working musicians are practicing this week." items={RELATED.trending} variant="mix" onCardClick={goToSong} />
          </div>

          {/* Right sidebar (desktop) */}
          <div className="gs-song-sidebar-desktop">
            <SongSidebar song={SONG} />
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
              <SongSidebar song={SONG} onClose={() => setDrawerOpen(false)} />
            </div>
          </>
        )}

        <Footer />
      </div>
    </div>
  );
}

export default SongDetail;
