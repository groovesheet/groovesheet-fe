// The three synchronized viewers for the song detail page:
//   <SheetMusicView/>  — real OSMD engraving (musicxml asset), cursor follows transport
//   <PianoRollView/>   — canvas piano roll from the parsed MIDI asset, playhead from transport
//   <StemsView/>       — real waveforms from thumb_data.stems, per-stem mute/solo/volume
// All views read the shared transport (src/player/transport.js) for time; none
// of them keeps its own clock.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Midi } from '@tonejs/midi';
import OSMDViewer from '../PreviewPanel/OSMDViewer';
import SkeletonPanel from '../ui/SkeletonPanel';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import StatusMessage from '../ui/StatusMessage';

// =================================================================
// 1) Sheet Music — OSMD
// =================================================================
export function SheetMusicView({ musicXmlText, loading, error, osmdRef, onPlaybackStateChange }) {
  // A score with no sounding notes (e.g. piano transcription of a track that
  // has no piano) makes OSMD's cursor init throw inside render() — never
  // mount the viewer for one, show an explanatory empty state instead.
  const hasNotes = useMemo(
    () => !musicXmlText || /<pitch[\s>]|<unpitched[\s>]/.test(musicXmlText),
    [musicXmlText]
  );

  // Phones render the score into a ~330px column. At the desktop zoom of 0.8
  // OSMD fits barely a measure per system, so the page becomes a ~10,000px
  // scroll and the title/composer credits collide on top of each other.
  // Scale the zoom (and claw back the side padding) with the viewport.
  const isNarrow = useMediaQuery('(max-width: 768px)');
  const isTiny = useMediaQuery('(max-width: 480px)');
  const sheetZoom = isTiny ? 0.5 : isNarrow ? 0.62 : 0.8;
  const sheetPad = isTiny ? '8px 6px 24px' : isNarrow ? '12px 10px 32px' : '24px 24px 48px';

  return (
    <div
      className="gs-sheet-scroll"
      style={{
        height: isNarrow ? 'min(72dvh, 980px)' : 'min(78vh, 980px)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: 'rgba(0,0,0,0.18)',
        padding: sheetPad,
      }}
    >
      {loading && (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-muted-foreground)', fontSize: 13 }}>
          Loading score…
        </div>
      )}
      {error && (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-muted-foreground)', fontSize: 13 }}>
          {error}
        </div>
      )}
      {!loading && !error && musicXmlText && !hasNotes && (
        <div style={{ maxWidth: 560, margin: '48px auto 0' }}>
          <StatusMessage variant="info" title="No notes detected">
            We couldn&apos;t find any piano in this section of the audio. Try a
            recording where the piano is clearly audible.
          </StatusMessage>
        </div>
      )}
      {!loading && !error && musicXmlText && hasNotes && (
        <div className="gs-sheet-page" style={{ maxWidth: 860, margin: '0 auto' }}>
          <OSMDViewer
            ref={osmdRef}
            xmlString={musicXmlText}
            theme="light"
            zoom={sheetZoom}
            drawTitle
            drawComposer={!isNarrow}
            drawLyricist={!isNarrow}
            drawCredits={!isNarrow}
            drawMetronomeMarks={false}
            onPlaybackStateChange={onPlaybackStateChange}
            containerStyle={{ minHeight: 600, padding: 0 }}
          />
        </div>
      )}
    </div>
  );
}

// =================================================================
// 2) Piano Roll — canvas, real MIDI notes
// =================================================================
// Same rendering approach as PreviewPanel/tabs/PianoRollTab.js (parse with
// @tonejs/midi, draw in a rAF loop, read transport.getPosition() each frame)
// but laid out horizontally: time → x, pitch → y, playhead fixed at 25%.
const ROLL_TRACK_COLORS = ['#7AA2FF', '#FF7BA9', '#FFC857', '#84F2A6', '#C9A0FF', '#5EE7DF'];
const ROLL_WINDOW_SEC = 12; // visible time span
const ROLL_PLAYHEAD_FRAC = 0.25; // playhead position within the window
const ROLL_RULER_H = 24;
const ROLL_GUTTER_W = 46;

function fmtClock(s) {
  const m = Math.floor(s / 60);
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  return `${m}:${ss}`;
}

// `ghosts` — other pitched instruments' MIDI, rendered faint behind the
// selected one so switching instruments keeps musical context:
//   [{ name, color, buffer: ArrayBuffer }]
export function PianoRollView({ midiBuffer, transport, loading, error, ghosts }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const transportRef = useRef(transport);
  const parsedRef = useRef(null); // { notes, ghostNotes, minPitch, maxPitch, duration, trackCount }
  const [parseError, setParseError] = useState(null);

  useEffect(() => { transportRef.current = transport; }, [transport]);

  useEffect(() => {
    if (!midiBuffer || !canvasRef.current) return undefined;
    let midi;
    try {
      midi = new Midi(midiBuffer);
    } catch (e) {
      setParseError('Could not parse the MIDI file.');
      return undefined;
    }
    setParseError(null);

    const tracks = midi.tracks.filter((t) => t.notes && t.notes.length);
    const notes = tracks
      .flatMap((t, ti) =>
        t.notes.map((n) => ({
          time: n.time,
          duration: n.duration,
          midi: n.midi,
          color: ROLL_TRACK_COLORS[ti % ROLL_TRACK_COLORS.length],
        }))
      )
      .sort((a, b) => a.time - b.time);
    // Non-selected instruments' notes, drawn first at very low opacity.
    const ghostNotes = [];
    (ghosts || []).forEach((g) => {
      if (!g || !g.buffer) return;
      let gm;
      try {
        gm = new Midi(g.buffer);
      } catch (e) {
        return; // a bad ghost file never blocks the main roll
      }
      gm.tracks.forEach((t) => {
        (t.notes || []).forEach((n) => {
          ghostNotes.push({ time: n.time, duration: n.duration, midi: n.midi, color: g.color || '#8d8c8d' });
        });
      });
    });
    let minPitch = 108;
    let maxPitch = 21;
    notes.concat(ghostNotes).forEach((n) => {
      if (n.midi < minPitch) minPitch = n.midi;
      if (n.midi > maxPitch) maxPitch = n.midi;
    });
    if (!notes.length) { minPitch = 48; maxPitch = 72; }
    minPitch = Math.max(0, minPitch - 2);
    maxPitch = Math.min(127, maxPitch + 2);
    while (maxPitch - minPitch < 24) { // keep a sane vertical scale
      if (minPitch > 0) minPitch -= 1;
      if (maxPitch < 127) maxPitch += 1;
    }
    parsedRef.current = { notes, ghostNotes, minPitch, maxPitch, duration: midi.duration || 0, trackCount: tracks.length };

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      const parsed = parsedRef.current;
      const t = transportRef.current;
      const pos = t ? t.getPosition() : 0;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // background
      ctx.fillStyle = '#08091a';
      ctx.fillRect(0, 0, w, h);

      const rollX = ROLL_GUTTER_W;
      const rollW = w - ROLL_GUTTER_W;
      const rollY = ROLL_RULER_H;
      const rollH = h - ROLL_RULER_H;
      const span = parsed.maxPitch - parsed.minPitch;
      const pitchH = rollH / span;
      const leftTime = pos - ROLL_WINDOW_SEC * ROLL_PLAYHEAD_FRAC;
      const pxPerSec = rollW / ROLL_WINDOW_SEC;

      // pitch rows + keyboard gutter
      ctx.fillStyle = '#0a0d24';
      ctx.fillRect(0, 0, ROLL_GUTTER_W, h);
      for (let p = parsed.minPitch; p <= parsed.maxPitch; p += 1) {
        const y = rollY + (parsed.maxPitch - p) * pitchH;
        const isBlack = [1, 3, 6, 8, 10].includes(p % 12);
        if (isBlack) {
          ctx.fillStyle = 'rgba(255,255,255,0.025)';
          ctx.fillRect(rollX, y, rollW, pitchH);
        }
        if (p % 12 === 0) {
          ctx.strokeStyle = 'rgba(255,255,255,0.12)';
          ctx.beginPath();
          ctx.moveTo(0, y + pitchH);
          ctx.lineTo(w, y + pitchH);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.font = '9px monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`C${Math.floor(p / 12) - 1}`, ROLL_GUTTER_W - 5, y + pitchH - 2);
        }
      }

      // time ruler + second gridlines
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(rollX, 0, rollW, ROLL_RULER_H);
      const firstSec = Math.max(0, Math.floor(leftTime));
      for (let s = firstSec; s <= leftTime + ROLL_WINDOW_SEC + 1; s += 1) {
        const x = rollX + (s - leftTime) * pxPerSec;
        if (x < rollX || x > w) continue;
        const major = s % 5 === 0;
        ctx.strokeStyle = major ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.moveTo(x, major ? 0 : ROLL_RULER_H);
        ctx.lineTo(x, h);
        ctx.stroke();
        if (major) {
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.font = '10px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(fmtClock(s), x + 4, 15);
        }
      }

      // ghost notes — other instruments, faint, under the selected one
      const rightTime = leftTime + ROLL_WINDOW_SEC;
      (parsed.ghostNotes || []).forEach((n) => {
        if (n.time + n.duration < leftTime || n.time > rightTime) return;
        const x = rollX + (n.time - leftTime) * pxPerSec;
        const nw = Math.max(2, n.duration * pxPerSec - 1);
        const y = rollY + (parsed.maxPitch - n.midi) * pitchH;
        const nh = Math.max(3, pitchH - 1);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = 0.09;
        ctx.fillRect(Math.max(rollX, x), y, nw - Math.max(0, rollX - x), nh);
        ctx.globalAlpha = 1;
      });

      // notes
      parsed.notes.forEach((n) => {
        if (n.time + n.duration < leftTime || n.time > rightTime) return;
        const x = rollX + (n.time - leftTime) * pxPerSec;
        const nw = Math.max(2, n.duration * pxPerSec - 1);
        const y = rollY + (parsed.maxPitch - n.midi) * pitchH;
        const nh = Math.max(3, pitchH - 1);
        const isPast = n.time + n.duration < pos;
        ctx.fillStyle = n.color;
        ctx.globalAlpha = isPast ? 0.4 : 0.88;
        ctx.fillRect(Math.max(rollX, x), y, nw - Math.max(0, rollX - x), nh);
        ctx.globalAlpha = 1;
      });

      // playhead
      const phX = rollX + (pos - leftTime) * pxPerSec;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(phX, 0);
      ctx.lineTo(phX, h);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(phX - 5, 0);
      ctx.lineTo(phX + 5, 0);
      ctx.lineTo(phX, 7);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 1;

      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [midiBuffer, ghosts]);

  const onClickSeek = useCallback((e) => {
    const t = transportRef.current;
    const parsed = parsedRef.current;
    const canvas = canvasRef.current;
    if (!t || !parsed || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < ROLL_GUTTER_W) return;
    const rollW = rect.width - ROLL_GUTTER_W;
    const pos = t.getPosition();
    const leftTime = pos - ROLL_WINDOW_SEC * ROLL_PLAYHEAD_FRAC;
    const target = leftTime + ((x - ROLL_GUTTER_W) / rollW) * ROLL_WINDOW_SEC;
    t.seek(Math.max(0, target));
  }, []);

  return (
    <div className="gs-pianoroll" style={{ position: 'relative' }}>
      {loading && (
        <div style={{ padding: 24 }}>
          <SkeletonPanel count={1} height={200} />
        </div>
      )}
      {(error || parseError) && !loading && (
        <div style={{ padding: 24 }}>
          <StatusMessage variant="error">{error || parseError}</StatusMessage>
        </div>
      )}
      {!loading && !error && midiBuffer && (
        <canvas
          ref={canvasRef}
          onClick={onClickSeek}
          style={{ display: 'block', width: '100%', height: 460, cursor: 'pointer' }}
        />
      )}
    </div>
  );
}

// =================================================================
// 3) Stems — real waveforms from thumb_data.stems
// =================================================================
// `stems` rows: [{ name, label, color, sub, wave: number[] /* 0-100 */ }]
// The playhead/progress is driven imperatively: one rAF loop writes a CSS
// variable (--gs-prog, a percentage) on the list element, and each row's
// bright-waveform clip + playhead line are pure CSS off that variable — no
// React re-render per frame.
export function StemsView({
  stems,
  stemState,
  onStemChange,
  onSeek,
  transport,
  statusText,
  separatorName = 'GrooveSheet BS-Roformer',
}) {
  const listRef = useRef(null);

  useEffect(() => {
    if (!transport) return undefined;
    let raf;
    const tick = () => {
      const el = listRef.current;
      if (el) {
        const st = transport.getState();
        const p = st.durationSec > 0 ? Math.max(0, Math.min(1, st.positionSec / st.durationSec)) : 0;
        el.style.setProperty('--gs-prog', `${(p * 100).toFixed(3)}%`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [transport]);

  const anySolo = Object.values(stemState).some((x) => x && x.solo);

  return (
    <div className="gs-stems-list" ref={listRef} style={{ padding: '10px' }}>
      {stems.map((s) => (
        <StemRow
          key={s.name}
          stem={s}
          state={stemState[s.name] || { mute: false, solo: false, volume: 75 }}
          onChange={(patch) => onStemChange(s.name, patch)}
          onSeek={onSeek}
          anySolo={anySolo}
        />
      ))}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 6,
          padding: '14px 16px',
          borderRadius: 10,
          background: 'var(--color-surface-light)',
          border: '1px dashed var(--color-border-light)',
          fontSize: 12,
          color: 'var(--color-muted-foreground)',
        }}
      >
        <span>
          Sources: {stems.length} stems · separated by{' '}
          <strong style={{ color: 'var(--color-text)' }}>{separatorName}</strong>.
        </span>
        {statusText && <span>{statusText}</span>}
      </div>
    </div>
  );
}

function StemRow({ stem, state, onChange, onSeek, anySolo }) {
  const ref = useRef(null);
  const onClickWave = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    onSeek && onSeek(Math.max(0, Math.min(1, x / r.width)));
  };

  const effectivelyMuted = state.mute || (anySolo && !state.solo);

  return (
    <div className={`gs-stem-row ${effectivelyMuted ? 'muted' : ''} ${state.solo ? 'soloed' : ''}`} style={{ height: '168px' }}>
      <div className="gs-stem-head">
        <div style={{ minWidth: 0 }}>
          <div className="gs-stem-name" style={{ color: stem.color }}>
            {stem.label}
          </div>
          {stem.sub && <div className="gs-stem-sub">{stem.sub}</div>}
        </div>
      </div>

      <div
        className="gs-stem-wave-wrap"
        ref={ref}
        onClick={onClickWave}
        style={{ cursor: 'pointer', position: 'relative' }}
      >
        <StemWaveform stem={stem} muted={effectivelyMuted} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
        <button className={`gs-ms-btn m ${state.mute ? 'on' : ''}`} onClick={() => onChange({ mute: !state.mute })} title="Mute">
          M
        </button>
        <button className={`gs-ms-btn s ${state.solo ? 'on' : ''}`} onClick={() => onChange({ solo: !state.solo })} title="Solo">
          S
        </button>
        <input
          className="gs-slider"
          type="range"
          min="0"
          max="100"
          step="1"
          value={state.volume}
          onChange={(e) => onChange({ volume: parseInt(e.target.value, 10) })}
          style={{ width: 90, '--fill': state.volume + '%' }}
          title={`Volume ${state.volume}%`}
        />
        <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11, color: 'var(--color-muted-foreground)', width: 28, textAlign: 'right' }}>
          {state.volume}
        </span>
      </div>
    </div>
  );
}

function StemWaveform({ stem, muted }) {
  // Real waveform: `stem.wave` is thumb_data.stems[name] — 0..100 ints.
  const bars = useMemo(() => {
    const src = Array.isArray(stem.wave) && stem.wave.length ? stem.wave : [];
    if (!src.length) return new Array(200).fill(0.08); // no thumb → flat baseline
    return src.map((v) => Math.max(0.04, Math.min(1, (Number(v) || 0) / 100)));
  }, [stem.wave]);

  const N = bars.length;
  const barW = 220 / N;

  const renderBars = (opacity) =>
    bars.map((a, i) => {
      const x = i * barW + barW * 0.1;
      const h = 23 * a;
      return <rect key={i} x={x} y={26 - h} width={barW * 0.8} height={h * 2} rx="0.4" fill={stem.color} fillOpacity={opacity} />;
    });

  return (
    <div style={{ position: 'relative', width: '100%', height: '126px' }}>
      {/* dim (unplayed) layer */}
      <svg
        viewBox="0 0 220 52"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        style={{ display: 'block' }}
        className="gs-stem-wave"
      >
        <line x1={0} x2={220} y1={26} y2={26} stroke={stem.color} strokeOpacity={0.18} strokeWidth="0.5" />
        {renderBars(muted ? 0.18 : 0.45)}
      </svg>
      {/* bright (played) layer, clipped at the playhead via --gs-prog */}
      <svg
        viewBox="0 0 220 52"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        className="gs-stem-wave"
        style={{
          display: 'block',
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          clipPath: 'inset(0 calc(100% - var(--gs-prog, 0%)) 0 0)',
        }}
      >
        {renderBars(muted ? 0.18 : 0.95)}
      </svg>
      {/* playhead */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 'var(--gs-prog, 0%)',
          width: 1.5,
          background: '#fff',
          opacity: 0.85,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
