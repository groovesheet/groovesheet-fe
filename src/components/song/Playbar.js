import React, { useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ArrowsClockwise,
  SpeakerHigh,
  SpeakerSlash,
  Minus,
  Plus,
  Metronome,
} from '@phosphor-icons/react';

function Playbar({
  isPlaying,
  onPlayPause,
  currentSec,
  totalSec,
  tempo,
  onTempo,
  transpose,
  onTranspose,
  volume,
  onVolume,
  muted,
  onMute,
  onSeekFraction,
  fmtTime,
}) {
  const scrubRef = useRef(null);
  const [hoverPct, setHoverPct] = useState(null);
  const progress = totalSec > 0 ? Math.min(1, currentSec / totalSec) : 0;

  const onScrub = (e) => {
    const r = scrubRef.current.getBoundingClientRect();
    onSeekFraction((e.clientX - r.left) / r.width);
  };
  const onScrubHover = (e) => {
    const r = scrubRef.current.getBoundingClientRect();
    setHoverPct((e.clientX - r.left) / r.width);
  };

  const tempoMin = 50;
  const tempoMax = 150;
  const tempoFill = ((tempo - tempoMin) / (tempoMax - tempoMin)) * 100;
  const volFill = muted ? 0 : volume;

  return (
    <div className="gs-playbar">
      <div
        className="gs-playbar-scrub"
        ref={scrubRef}
        onClick={onScrub}
        onMouseMove={onScrubHover}
        onMouseLeave={() => setHoverPct(null)}
      >
        <div className="gs-playbar-scrub-fill" style={{ width: `${progress * 100}%` }} />
        <div className="gs-playbar-scrub-head" style={{ left: `${progress * 100}%` }} />
        {hoverPct != null && (
          <div className="gs-playbar-scrub-tooltip" style={{ left: `${hoverPct * 100}%` }}>
            {fmtTime(hoverPct * totalSec)}
          </div>
        )}
      </div>

      <div className="gs-playbar-inner">
        <div className="gs-transport">
          <button
            className="gs-ctrl"
            title="Restart"
            onClick={() => onSeekFraction(0)}
          >
            <SkipBack size={16} weight="fill" />
          </button>
          <button
            className="gs-ctrl gs-ctrl-play"
            onClick={onPlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
          </button>
          <button
            className="gs-ctrl"
            title="Skip to end"
            onClick={() => onSeekFraction(0.999)}
          >
            <SkipForward size={16} weight="fill" />
          </button>
          <button className="gs-ctrl" title="Loop" disabled>
            <ArrowsClockwise size={16} />
          </button>
        </div>

        <div className="gs-pb-divider" />

        <div className="gs-pb-time">
          <span className="now">{fmtTime(currentSec)}</span>
          <span className="slash">/</span>
          <span>{fmtTime(totalSec)}</span>
        </div>

        <div className="gs-pb-divider" />

        <div className="gs-pb-group">
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
            style={{ width: 110, '--fill': `${tempoFill}%` }}
            title="Tempo · double-click to reset"
          />
          <span className="gs-pb-knob-val">{tempo}%</span>
        </div>

        <div className="gs-pb-divider" />

        <div className="gs-pb-group">
          <span className="gs-pb-knob-label">Transpose</span>
          <div className="gs-pb-stepper">
            <button
              className="gs-ctrl gs-ctrl-tiny"
              onClick={() => onTranspose(transpose - 1)}
              title="Down semitone"
            >
              <Minus size={12} weight="bold" />
            </button>
            <span
              className="gs-pb-stepper-val"
              onDoubleClick={() => onTranspose(0)}
              title="Double-click to reset"
            >
              {transpose > 0 ? '+' : ''}
              {transpose} st
            </span>
            <button
              className="gs-ctrl gs-ctrl-tiny"
              onClick={() => onTranspose(transpose + 1)}
              title="Up semitone"
            >
              <Plus size={12} weight="bold" />
            </button>
          </div>
        </div>

        <div className="gs-pb-divider" />

        <button className="gs-ctrl" title="Metronome" disabled>
          <Metronome size={16} />
        </button>

        <div className="gs-pb-spacer" />

        <div className="gs-pb-group">
          <button className="gs-ctrl" onClick={onMute} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? <SpeakerSlash size={16} /> : <SpeakerHigh size={16} />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={muted ? 0 : volume}
            onChange={(e) => onVolume(parseInt(e.target.value, 10))}
            className="gs-slider"
            style={{ width: 90, '--fill': `${volFill}%` }}
            title="Master volume"
          />
        </div>
      </div>
    </div>
  );
}

export default Playbar;
