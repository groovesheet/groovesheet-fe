import React, { useEffect, useRef } from 'react';
import {
  NUM_STRINGS,
  FRET_COUNT,
  OPEN_COL_W,
  FRET_COL_W,
  SINGLE_INLAYS,
  DOUBLE_INLAY,
  assignFretPositions,
  midiToNoteName,
} from './fretboardLayout';

/**
 * VideoFretboardRoll — "falling keys, but for guitar".
 *
 * A horizontal fretboard is drawn across the bottom of the canvas; each note is a
 * circle that falls straight down the column above its target FRET and lands on
 * its target STRING row exactly at note.time — hitting the (string, fret) cell.
 * On the hit it leaves a labelled dot that fades over the note's duration.
 *
 * Sibling to VideoPianoRoll: same rAF + timeRef + DPR scaffolding, but the
 * fretboard drawing + MIDI→position mapping live here (and in fretboardLayout).
 * Notes arrive as { time, duration, midi }; assignFretPositions() annotates each
 * with { string, fret } once.
 */

const VISIBLE_WINDOW = 3; // seconds of lookahead (matches the piano roll)
const HIT_COLOR = '#012FA7'; // GrooveSheet brand blue (hit line)

// per-string colour, low E → high E. Warm-to-cool so strings read apart.
const STRING_COLORS = ['#E8590C', '#F08C00', '#F5C518', '#2F9E44', '#1098AD', '#4263EB'];

function drawFretboard(ctx, w, fretToX, stringToY, yTop, boardH, scale) {
  // board surface
  const grad = ctx.createLinearGradient(0, yTop, 0, yTop + boardH);
  grad.addColorStop(0, '#2a1c12');
  grad.addColorStop(1, '#1a110a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, yTop, w, boardH);

  // hit line along the top of the board
  ctx.fillStyle = HIT_COLOR;
  ctx.fillRect(0, yTop - 4 * scale, w, 4 * scale);

  // fret wires (vertical) at each column boundary; nut (fret 0) is thicker.
  for (let f = 0; f <= FRET_COUNT; f += 1) {
    const x = fretBoundaryX(f);
    ctx.fillStyle = f === 0 ? '#e8e3d8' : 'rgba(200,200,190,0.45)';
    const wire = f === 0 ? 6 * scale : 2 * scale;
    ctx.fillRect(x - wire / 2, yTop, wire, boardH);
  }

  // inlay markers (between strings, vertically centred on the board)
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  const dotR = 7 * scale;
  for (const f of SINGLE_INLAYS) {
    if (f > FRET_COUNT) continue;
    ctx.beginPath();
    ctx.arc(fretToX(f), yTop + boardH / 2, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
  if (DOUBLE_INLAY <= FRET_COUNT) {
    const x = fretToX(DOUBLE_INLAY);
    ctx.beginPath(); ctx.arc(x, yTop + boardH * 0.3, dotR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, yTop + boardH * 0.7, dotR, 0, Math.PI * 2); ctx.fill();
  }

  // strings (horizontal). Low strings are thicker.
  for (let s = 0; s < NUM_STRINGS; s += 1) {
    const y = stringToY(s);
    ctx.strokeStyle = 'rgba(220,220,210,0.55)';
    ctx.lineWidth = (1 + (NUM_STRINGS - 1 - s) * 0.5) * scale; // s=0 (low E) thickest
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

// column boundary x for fret f (f=0 is the nut). Uses the same unit scale as
// fretToX so wires and centres line up.
let _unitScale = 1;
function fretBoundaryX(f) {
  if (f === 0) return OPEN_COL_W * _unitScale;
  return (OPEN_COL_W + f * FRET_COL_W) * _unitScale;
}

export default function VideoFretboardRoll({ notes, timeRef }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!notes || !notes.length) return undefined;

    const allNotes = assignFretPositions(notes)
      .filter((n) => n.fret != null && n.string != null)
      .slice()
      .sort((a, b) => a.time - b.time);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.max(1, Math.round((rect.width || canvas.clientWidth) * dpr));
      const ch = Math.max(1, Math.round((rect.height || canvas.clientHeight) * dpr));
      if (canvas.width !== cw) canvas.width = cw;
      if (canvas.height !== ch) canvas.height = ch;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const scale = w / 3840; // size strokes/dots relative to the native frame width
      const elapsed = timeRef?.current ?? 0;

      const boardH = Math.round(h * 0.32);
      const yTop = h - boardH; // board occupies the bottom; falling area above
      const fallH = yTop;

      // fit FRET_COUNT frets + the nut column into the canvas width.
      const totalUnits = OPEN_COL_W + FRET_COUNT * FRET_COL_W;
      _unitScale = w / totalUnits;
      const fretToX = (f) => (f === 0
        ? (OPEN_COL_W / 2) * _unitScale
        : (OPEN_COL_W + (f - 0.5) * FRET_COL_W) * _unitScale);
      const stringToY = (s) => yTop + (s + 0.5) * (boardH / NUM_STRINGS);

      // background (above the board)
      ctx.fillStyle = '#0c100c';
      ctx.fillRect(0, 0, w, fallH);

      drawFretboard(ctx, w, fretToX, stringToY, yTop, boardH, scale);

      const noteR = 26 * scale;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < allNotes.length; i += 1) {
        const note = allNotes[i];
        if (note.time - elapsed > VISIBLE_WINDOW) break; // not visible yet → stop
        if (note.time + note.duration < elapsed) continue; // fully passed
        const color = STRING_COLORS[note.string] || HIT_COLOR;
        const xHit = fretToX(note.fret);
        const yHit = stringToY(note.string);

        if (note.time > elapsed) {
          // falling: x fixed over the fret column, y reaches the cell at note.time
          const y = yHit - ((note.time - elapsed) / VISIBLE_WINDOW) * fallH;
          ctx.beginPath();
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 22 * scale;
          ctx.arc(xHit, y, noteR, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#fff';
          ctx.font = `700 ${Math.round(20 * scale)}px "Hubot Sans", Inter, system-ui, sans-serif`;
          ctx.fillText(String(note.fret), xHit, y);
        } else {
          // landed: dot on the cell, fading over the note's duration
          const life = note.duration > 0 ? (elapsed - note.time) / note.duration : 1;
          const alpha = Math.max(0, 1 - life);
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 30 * scale;
          ctx.arc(xHit, yHit, noteR * (1 + 0.25 * (1 - alpha)), 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#fff';
          ctx.font = `700 ${Math.round(18 * scale)}px "Hubot Sans", Inter, system-ui, sans-serif`;
          ctx.fillText(midiToNoteName(note.midi), xHit, yHit);
          ctx.globalAlpha = 1;
        }
      }

      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [notes, timeRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}

export { STRING_COLORS };
