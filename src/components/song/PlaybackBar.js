// Sticky playback bar — transport, time, tempo, transpose, A/B loop, volume,
// theme, fullscreen. Ported from the design pack (song-playback.jsx).
import React, { useRef, useState } from 'react';
import { Icon } from './icons';
import { fmtTime } from '../../mocks/songDetailData';

function PlaybackBar({
  isPlaying,
  onPlayPause,
  currentSec,
  totalSec,
  tempo,
  onTempo,
  transpose,
  onTranspose,
  loopMode,
  onLoopMode,
  loopRegion, // { startBeat, endBeat } | null
  volume,
  onVolume,
  muted,
  onMute,
  metronome,
  onMetronome,
  dark,
  onToggleTheme,
  onFullscreen,
  onSeekFraction,
  totalBeats,
}) {
  const scrubRef = useRef(null);
  const [hoverPct, setHoverPct] = useState(null);

  const progress = totalSec > 0 ? currentSec / totalSec : 0;

  const onScrub = (e) => {
    const r = scrubRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    if (onSeekFraction) onSeekFraction(Math.max(0, Math.min(1, x)));
  };
  const onScrubHover = (e) => {
    const r = scrubRef.current.getBoundingClientRect();
    setHoverPct((e.clientX - r.left) / r.width);
  };

  const tempoMin = 50;
  const tempoMax = 150;
  const tempoFill = ((tempo - tempoMin) / (tempoMax - tempoMin)) * 100;
  const volFill = volume;

  let loopOverlay = null;
  if (loopRegion && totalBeats > 0) {
    const x1 = (loopRegion.startBeat / totalBeats) * 100;
    const x2 = (loopRegion.endBeat / totalBeats) * 100;
    loopOverlay = (
      <div className="gs-playbar-scrub-loop" style={{ left: x1 + '%', width: x2 - x1 + '%' }} />
    );
  }

  return (
    <div className="gs-playbar" style={{ position: 'relative', top: 'auto' }}>
      {/* Top row: scrubber */}
      <div
        className="gs-playbar-scrub"
        ref={scrubRef}
        onClick={onScrub}
        onMouseMove={onScrubHover}
        onMouseLeave={() => setHoverPct(null)}
      >
        <div className="gs-playbar-scrub-fill" style={{ width: progress * 100 + '%' }} />
        {loopOverlay}
        <div className="gs-playbar-scrub-head" style={{ left: progress * 100 + '%' }} />
        {hoverPct != null && (
          <div
            style={{
              position: 'absolute',
              left: hoverPct * 100 + '%',
              top: -28,
              transform: 'translateX(-50%)',
              background: 'var(--color-panel1)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border-light)',
              borderRadius: 4,
              padding: '2px 6px',
              fontFamily: 'var(--font-family-mono)',
              fontSize: 10,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {fmtTime(hoverPct * totalSec)}
          </div>
        )}
      </div>

      {/* Bottom row: controls */}
      <div className="gs-playbar-inner">
        {/* Transport cluster */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <button className="gs-ctrl" title="Previous" onClick={() => onSeekFraction && onSeekFraction(0)}>
            <Icon.Prev />
          </button>
          <button className="gs-ctrl gs-ctrl-play" onClick={onPlayPause} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <Icon.Pause /> : <Icon.Play />}
          </button>
          <button className="gs-ctrl" title="Next" onClick={() => onSeekFraction && onSeekFraction(0.999)}>
            <Icon.Next />
          </button>
          <button
            className={`gs-ctrl ${loopMode !== 'off' ? 'gs-ctrl-on' : ''}`}
            onClick={onLoopMode}
            title={`Loop: ${loopMode}`}
          >
            <Icon.Loop />
            {loopMode === 'ab' && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  position: 'absolute',
                  transform: 'translate(7px, 8px)',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  padding: '0 3px',
                  borderRadius: 2,
                }}
              >
                A-B
              </span>
            )}
          </button>
        </div>

        <div className="gs-pb-divider" />

        {/* Time */}
        <div className="gs-pb-time">
          <span className="now">{fmtTime(currentSec)}</span>
          <span style={{ margin: '0 6px', opacity: 0.5 }}>/</span>
          <span>{fmtTime(totalSec)}</span>
        </div>

        <div className="gs-pb-divider" />

        {/* Tempo */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <span className="gs-pb-knob-label">Tempo</span>
          <input
            type="range"
            min={tempoMin}
            max={tempoMax}
            step={1}
            value={tempo}
            onChange={(e) => onTempo(parseInt(e.target.value, 10))}
            onDoubleClick={() => onTempo(100)}
            className="gs-slider"
            style={{ width: 110, '--fill': tempoFill + '%' }}
            title="Tempo · double-click to reset"
          />
          <button
            className="gs-pb-knob"
            onClick={() => onTempo(100)}
            style={{ height: 26, padding: '0 8px', borderStyle: 'none' }}
            title="Reset tempo"
          >
            <span className="gs-pb-knob-val" style={{ minWidth: 'auto' }}>
              {tempo}%
            </span>
          </button>
        </div>

        <div className="gs-pb-divider" />

        {/* Transpose */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="gs-pb-knob-label">Transpose</span>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0,
              background: 'var(--color-surface-light)',
              border: '1px solid var(--color-border-light)',
              borderRadius: 6,
              height: 26,
              padding: '0 2px',
            }}
          >
            <button className="gs-ctrl" style={{ width: 24, height: 22 }} onClick={() => onTranspose(transpose - 1)} title="Down semitone">
              <Icon.Minus />
            </button>
            <span
              style={{
                minWidth: 46,
                textAlign: 'center',
                fontFamily: 'var(--font-family-mono)',
                fontSize: 12,
                color: 'var(--color-text)',
                fontWeight: 500,
                fontVariantNumeric: 'tabular-nums',
                cursor: 'pointer',
              }}
              onDoubleClick={() => onTranspose(0)}
              title="Double-click to reset"
            >
              {transpose > 0 ? '+' : ''}
              {transpose} st
            </span>
            <button className="gs-ctrl" style={{ width: 24, height: 22 }} onClick={() => onTranspose(transpose + 1)} title="Up semitone">
              <Icon.Plus />
            </button>
          </div>
        </div>

        <div className="gs-pb-divider" />

        {/* Metronome */}
        <button className={`gs-ctrl ${metronome ? 'gs-ctrl-on' : ''}`} onClick={onMetronome} title="Metronome">
          <Icon.Metronome />
        </button>

        {/* Spacer */}
        <div style={{ flex: 1, minWidth: 8 }} />

        {/* Volume */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <button className="gs-ctrl" onClick={onMute} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? <Icon.VolMute /> : <Icon.Vol />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={muted ? 0 : volume}
            onChange={(e) => onVolume(parseInt(e.target.value, 10))}
            className="gs-slider"
            style={{ width: 90, '--fill': (muted ? 0 : volFill) + '%' }}
            title="Master volume"
          />
        </div>

        <div className="gs-pb-divider" />

        <button className="gs-ctrl" onClick={onToggleTheme} title={dark ? 'Light theme' : 'Dark theme'}>
          {dark ? <Icon.Sun /> : <Icon.Moon />}
        </button>
        <button className="gs-ctrl" onClick={onFullscreen} title="Fullscreen">
          <Icon.Fullscreen />
        </button>
      </div>
    </div>
  );
}

export default PlaybackBar;
