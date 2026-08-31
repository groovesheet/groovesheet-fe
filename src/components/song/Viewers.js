import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MusicNotes, FileX } from '@phosphor-icons/react';
import CanvasPianoRoll from '../visualization/PianoRollView';

// ---------------- Sheet music ----------------
//
// The library indexes one MusicXML asset per transcribed instrument
// (asset_type 'musicxml', stem_name 'drums' | 'piano' | 'bass'). This used to
// be a hardcoded "No MusicXML asset yet" panel, so a song whose drum score had
// been engraved, published as a video AND indexed here still told the visitor
// it had nothing — 任性 (Mayday) had 1535 notes across 95 measures sitting
// behind that message.
const SCORE_LABELS = { drums: 'Drums', piano: 'Piano', bass: 'Bass' };
const SCORE_ORDER = ['piano', 'drums', 'bass'];

function deriveScores(assets) {
  return (assets || [])
    .filter((a) => a.asset_type === 'musicxml' && a.id)
    .map((a) => ({ id: a.id, name: a.stem_name || 'score' }))
    .sort((a, b) => {
      const ia = SCORE_ORDER.indexOf(a.name);
      const ib = SCORE_ORDER.indexOf(b.name);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
}

// Assets are served by a redirect to storage (same shape the stems use), so
// the score needs no auth for a public track.
function scoreUrl(assetId) {
  return `/api/library/assets/${assetId}/url?purpose=stream`;
}

function EngravedScore({ assetId }) {
  const containerRef = useRef(null);
  const osmdRef = useRef(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!assetId || !containerRef.current) return;
      setState('loading');
      try {
        const resp = await fetch(scoreUrl(assetId));
        if (!resp.ok) throw new Error(`score fetch failed (${resp.status})`);
        const xml = await resp.text();
        if (cancelled) return;

        // Dynamic import: OSMD is large and only this tab needs it.
        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');
        if (cancelled || !containerRef.current) return;

        if (osmdRef.current) osmdRef.current.clear();
        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          drawTitle: false,      // the page header already names the song
          drawComposer: false,
          drawCredits: false,
          drawPartNames: true,
          backend: 'svg',
        });
        osmdRef.current = osmd;
        await osmd.load(xml);
        if (cancelled) return;
        osmd.render();
        setState('ready');
      } catch (err) {
        if (!cancelled) {
          console.error('sheet render failed:', err);
          setState('error');
        }
      }
    };
    render();
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return (
    <div className="gs-sheet-page" data-page={`— 1 —`}>
      {state === 'error' && (
        <div className="gs-sheet-empty-inner">
          <FileX size={28} weight="duotone" />
          <h3>Score could not be loaded</h3>
          <p>The MusicXML asset exists but could not be rendered. Try again shortly.</p>
        </div>
      )}
      <div ref={containerRef} hidden={state !== 'ready'} />
      {state === 'loading' && (
        <div className="gs-sheet-empty-inner">
          <MusicNotes size={28} weight="duotone" />
          <h3>Engraving score…</h3>
        </div>
      )}
    </div>
  );
}

export function SheetView({ track }) {
  const scores = useMemo(() => deriveScores(track.assets), [track.assets]);
  const [active, setActive] = useState(0);
  const current = scores[Math.min(active, scores.length - 1)];

  if (!scores.length) {
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

  return (
    <div className="gs-sheet">
      {scores.length > 1 && (
        <div className="song-seg gs-sheet-parts" role="tablist">
          {scores.map((s, i) => (
            <button
              key={s.id}
              className={i === active ? 'on' : ''}
              onClick={() => setActive(i)}
            >
              {SCORE_LABELS[s.name] || s.name}
            </button>
          ))}
        </div>
      )}
      <EngravedScore assetId={current.id} />
    </div>
  );
}

// ---------------- Piano roll ----------------
//
// The aligned MIDI is the same file the social video was rendered from, so the
// roll here matches what the viewer saw on YouTube/bilibili. Indexed as
// asset_type 'midi' (stem_name 'drums' today — the drum chain is the only one
// whose forward carries a MIDI key so far).
function deriveMidis(assets) {
  return (assets || [])
    .filter((a) => a.asset_type === 'midi' && a.id)
    .map((a) => ({ id: a.id, name: a.stem_name || 'midi' }));
}

export function PianoRollView({ track, stems }) {
  const midis = useMemo(() => deriveMidis(track.assets), [track.assets]);
  const [active, setActive] = useState(0);
  const current = midis[Math.min(active, midis.length - 1)];

  if (!midis.length) {
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

  return (
    <div className="gs-pianoroll">
      {midis.length > 1 && (
        <div className="song-seg gs-pianoroll-parts" role="tablist">
          {midis.map((m, i) => (
            <button
              key={m.id}
              className={i === active ? 'on' : ''}
              onClick={() => setActive(i)}
            >
              {SCORE_LABELS[m.name] || m.name}
            </button>
          ))}
        </div>
      )}
      <CanvasPianoRoll midiUrl={scoreUrl(current.id)} />
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
