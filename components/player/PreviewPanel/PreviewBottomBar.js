import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import {
  SkipBack,
  Play,
  Pause,
  FileAudio,
  MusicNotes,
  Equalizer,
  GitMerge,
  File as FileIcon,
  CaretDown,
} from '@phosphor-icons/react';

// Stem-source label per instrument; anything unlisted keeps the historical
// piano wording so existing surfaces render byte-identically.
const STEM_SOURCE_LABEL_BY_INSTRUMENT = {
  drums: 'Drums Stem',
  bass: 'Bass Stem',
  jazz_bass: 'Bass Stem',
};

function buildSources(instrument) {
  const stemLabel = STEM_SOURCE_LABEL_BY_INSTRUMENT[instrument] || 'Piano Stem';
  return [
    { id: 'transcription', label: 'Transcription', Icon: MusicNotes },
    { id: 'midi', label: 'MIDI', Icon: Equalizer },
    { id: 'piano_stem', label: stemLabel, Icon: GitMerge },
    { id: 'original', label: 'Original', Icon: FileIcon },
  ];
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function formatSpeed(s) {
  return `${Number.isInteger(s) ? s : s}x`;
}

export default function PreviewBottomBar({
  currentTime = 1,
  duration = 221,
  isPlaying = false,
  onTogglePlay,
  onSkipBack,
  speed = 1,
  onChangeSpeed,
  activeSource: activeSourceProp,
  onChangeSource,
  instrument,
}) {
  const sources = buildSources(instrument);
  const [localPlaying, setLocalPlaying] = useState(isPlaying);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [localSource, setLocalSource] = useState('transcription');
  const [speedOpen, setSpeedOpen] = useState(false);
  const activeSource = activeSourceProp ?? localSource;
  const playing = onTogglePlay ? isPlaying : localPlaying;
  const handlePlay = () => {
    if (onTogglePlay) onTogglePlay();
    else setLocalPlaying((p) => !p);
  };
  const handlePickSource = (id) => {
    if (onChangeSource) onChangeSource(id);
    else setLocalSource(id);
  };
  const handlePickSpeed = (s) => {
    if (onChangeSpeed) onChangeSpeed(s);
    setSpeedOpen(false);
  };
  const activeLabel = sources.find((s) => s.id === activeSource)?.label || 'Audio Source';
  const node = (
    <div className="preview-bottom-bar">
      <div className="preview-bottom-bar-left">
        <div className="preview-bottom-bar-transport-pill">
          <div className="preview-bottom-bar-transport">
            <button
              type="button"
              className="preview-bottom-bar-btn"
              onClick={onSkipBack}
              aria-label="Skip back"
            >
              <SkipBack size={28} weight="fill" />
            </button>
            <button
              type="button"
              className="preview-bottom-bar-btn"
              onClick={handlePlay}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause size={28} weight="fill" /> : <Play size={28} weight="fill" />}
            </button>
          </div>
          <div className="preview-bottom-bar-time">
            <span className="preview-bottom-bar-time-current">{formatTime(currentTime)}</span>
            <span className="preview-bottom-bar-time-sep">/</span>
            <span className="preview-bottom-bar-time-total">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="preview-bottom-bar-speed-wrap">
          <button
            type="button"
            className="preview-bottom-bar-speed"
            onClick={() => setSpeedOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={speedOpen}
          >
            <span>{formatSpeed(speed)}</span>
            <CaretDown size={24} weight="fill" />
          </button>
          {speedOpen && (
            <div className="preview-bottom-bar-speed-menu" role="listbox">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="option"
                  aria-selected={s === speed}
                  className={`preview-bottom-bar-speed-option ${s === speed ? 'active' : ''}`}
                  onClick={() => handlePickSpeed(s)}
                >
                  {formatSpeed(s)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="preview-bottom-bar-right">
        {sourcesExpanded ? (
          <div className="preview-bottom-bar-sources" role="radiogroup" aria-label="Audio source">
            {sources.map(({ id, label, Icon }) => {
              const isActive = id === activeSource;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className={`preview-bottom-bar-source-pill ${isActive ? 'active' : ''}`}
                  onClick={() => handlePickSource(id)}
                >
                  <Icon size={24} />
                  <span>{label}</span>
                </button>
              );
            })}
            <button
              type="button"
              className="preview-bottom-bar-source-collapse"
              onClick={() => setSourcesExpanded(false)}
              aria-label="Collapse audio sources"
            >
              ×
            </button>
          </div>
        ) : (
          <div className="preview-bottom-bar-source-wrap">
            <button
              type="button"
              className="preview-bottom-bar-source"
              onClick={() => setSourcesExpanded(true)}
            >
              <FileAudio size={24} />
              <span>{activeLabel}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
  if (typeof document === 'undefined') return null;
  return ReactDOM.createPortal(node, document.body);
}
