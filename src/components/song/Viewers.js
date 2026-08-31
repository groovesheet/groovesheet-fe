import React, { useEffect, useMemo, useRef } from 'react';
import { MusicNotes, FileX } from '@phosphor-icons/react';

// ---------------- Sheet music placeholder ----------------
export function SheetView({ track }) {
  return (
    <div className="gs-sheet-empty">
      <div className="gs-sheet-page" data-page={`— 1 —`}>
        <div className="gs-sheet-empty-inner">
          <MusicNotes size={28} weight="duotone" />
          <h3>No MusicXML asset yet</h3>
          <p>
            {track.title} doesn’t have a typeset score available. Run a workflow to
            generate a MusicXML asset, then the engraved page will render here.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------- Piano roll placeholder ----------------
export function PianoRollView({ track, stems }) {
  return (
    <div className="gs-pianoroll-empty">
      <div className="gs-pianoroll-empty-inner">
        <FileX size={28} weight="duotone" />
        <h3>No MIDI asset yet</h3>
        <p>
          A combined piano roll requires per-instrument MIDI files. The library
          currently only indexes audio stems for {track.title} ({stems.length} found).
        </p>
      </div>
    </div>
  );
}

// ---------------- Stems view (real playback) ----------------
//
// Each stem renders its own <audio> element pointed at the BE's signed-URL
// redirect (`GET /library/assets/{id}/url?purpose=stream`). The browser follows
// the 302 to R2 and starts streaming Opus. The parent component owns transport
// state (play/pause/seek/master volume); individual stem mute/solo/volume is
// managed locally by `<Stem>`.
function Stem({
  stem,
  state,
  onChange,
  isPlaying,
  currentSec,
  totalSec,
  masterVolume,
  masterMuted,
  anySolo,
  isPrimary,
  onTimeUpdate,
  onEnded,
  isMock,
}) {
  const audioRef = useRef(null);
  const effectivelyMuted = state.mute || (anySolo && !state.solo) || masterMuted;
  // Apply effective volume any time master/state/mute changes.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const v = effectivelyMuted ? 0 : (state.volume / 100) * (masterVolume / 100);
    el.volume = Math.max(0, Math.min(1, v));
  }, [effectivelyMuted, state.volume, masterVolume]);

  // Drive play/pause from parent state.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.play().catch(() => {
        /* user-gesture or network — caller surfaces play button */
      });
    } else {
      el.pause();
    }
  }, [isPlaying]);

  // Snap to parent-driven seeks. We only adopt the external time if it drifts
  // more than 0.4s so we don't fight per-frame ticks coming back from
  // onTimeUpdate.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (Math.abs(el.currentTime - currentSec) > 0.4) {
      el.currentTime = currentSec;
    }
  }, [currentSec]);

  const onClickWave = (e) => {
    if (!totalSec) return;
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const el = audioRef.current;
    if (el) el.currentTime = f * totalSec;
    onTimeUpdate?.(f * totalSec);
  };

  // Deterministic waveform pattern keyed by stem name.
  const bars = useMemo(() => {
    const seed = stem.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const rand = (i) => Math.abs(Math.sin(seed + i * 1.37)) * 0.6 + 0.2;
    return Array.from({ length: 220 }, (_, i) => {
      if (stem.name === 'drums') return rand(i) > 0.55 ? rand(i) : rand(i) * 0.3;
      if (stem.name === 'bass') {
        return Math.abs(Math.sin((i / 220) * Math.PI * 2.3)) * 0.7 + rand(i) * 0.2;
      }
      if (stem.name === 'vocals') {
        return Math.abs(0.3 + 0.6 * Math.sin((i / 220) * Math.PI * 4)) * (0.5 + rand(i) * 0.3);
      }
      return rand(i);
    });
  }, [stem.name]);

  const progress = totalSec > 0 ? Math.min(1, currentSec / totalSec) : 0;
  // In mock mode we have no real asset on the backend, so leave src empty —
  // the audio element renders but never loads. Real backend rows resolve via
  // the BE's signed-URL redirect.
  const streamUrl = isMock
    ? undefined
    : `/api/library/assets/${stem.assetId}/url?purpose=stream`;

  return (
    <div
      className={`gs-stem-row${effectivelyMuted ? ' muted' : ''}${state.solo ? ' soloed' : ''}`}
    >
      <div className="gs-stem-head">
        <div className="gs-stem-swatch" style={{ background: stem.color }} />
        <div style={{ minWidth: 0 }}>
          <div className="gs-stem-name">{stem.label}</div>
          <div className="gs-stem-sub">Opus stem</div>
        </div>
      </div>

      <div className="gs-stem-wave-wrap" onClick={onClickWave}>
        <svg
          viewBox="0 0 220 52"
          preserveAspectRatio="none"
          width="100%"
          height="100%"
          style={{ display: 'block' }}
        >
          <line
            x1="0"
            x2="220"
            y1="26"
            y2="26"
            stroke={stem.color}
            strokeOpacity="0.18"
            strokeWidth="0.5"
          />
          {bars.map((a, i) => {
            const x = i + 0.1;
            const h = 23 * a;
            const past = i / bars.length <= progress;
            return (
              <rect
                key={i}
                x={x}
                y={26 - h}
                width={0.85}
                height={h * 2}
                rx="0.4"
                fill={stem.color}
                fillOpacity={effectivelyMuted ? 0.18 : past ? 0.95 : 0.45}
              />
            );
          })}
          <line
            x1={progress * 220}
            x2={progress * 220}
            y1={0}
            y2={52}
            stroke="#fff"
            strokeWidth="0.5"
          />
        </svg>
      </div>

      <div className="gs-stem-controls">
        <button
          className={`gs-ms-btn m${state.mute ? ' on' : ''}`}
          onClick={() => onChange({ mute: !state.mute })}
          title="Mute"
        >
          M
        </button>
        <button
          className={`gs-ms-btn s${state.solo ? ' on' : ''}`}
          onClick={() => onChange({ solo: !state.solo })}
          title="Solo"
        >
          S
        </button>
        <input
          className="gs-slider"
          type="range"
          min={0}
          max={100}
          step={1}
          value={state.volume}
          onChange={(e) => onChange({ volume: parseInt(e.target.value, 10) })}
          style={{ width: 90, '--fill': `${state.volume}%` }}
          title={`Volume ${state.volume}%`}
        />
        <span className="gs-stem-vol">{state.volume}</span>
      </div>

      {streamUrl && (
        <audio
          ref={audioRef}
          src={streamUrl}
          preload="auto"
          onTimeUpdate={(e) => {
            if (isPrimary) onTimeUpdate?.(e.currentTarget.currentTime);
          }}
          onEnded={() => {
            if (isPrimary) onEnded?.();
          }}
        />
      )}
    </div>
  );
}

export function StemsView({
  stems,
  stemState,
  onStemChange,
  isPlaying,
  currentSec,
  totalSec,
  volume,
  muted,
  onTimeUpdate,
  onEnded,
  isMock,
}) {
  if (!stems.length) {
    return (
      <div className="gs-stems-empty">
        <h3>No streamable stems</h3>
        <p>
          This track has no Opus-format stems indexed yet. Stems must be compressed to
          Opus before they’re publicly streamable.
        </p>
      </div>
    );
  }

  const anySolo = Object.values(stemState).some((v) => v?.solo);

  return (
    <div className="gs-stems-list">
      {stems.map((s, i) => (
        <Stem
          key={s.name}
          stem={s}
          state={stemState[s.name] || { mute: false, solo: false, volume: 75 }}
          onChange={(patch) => onStemChange(s.name, patch)}
          isPlaying={isPlaying}
          currentSec={currentSec}
          totalSec={totalSec}
          masterVolume={volume}
          masterMuted={muted}
          anySolo={anySolo}
          isPrimary={i === 0}
          onTimeUpdate={onTimeUpdate}
          onEnded={onEnded}
          isMock={isMock}
        />
      ))}
      <div className="gs-stems-footer">
        {isMock
          ? 'Demo data — stem audio is disabled until the backend has a real row for this track.'
          : 'Stems streamed as Opus · separated by GrooveSheet pipeline.'}
      </div>
    </div>
  );
}
