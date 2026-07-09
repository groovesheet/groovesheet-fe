import React, { useEffect, useRef } from 'react';
import {
  getFretboard,
  OPEN_COL_W,
  FRET_COL_W,
  SINGLE_INLAYS,
  DOUBLE_INLAY,
  assignFretPositions,
  midiToPitchClass,
} from './fretboardLayout';

/**
 * VideoFretboardRoll — "falling keys, but for guitar (and bass)".
 *
 * A horizontal fretboard is drawn across the bottom of the canvas; each note is a
 * circle that falls straight down the column above its target FRET and lands on
 * its target STRING row exactly at note.time — hitting the (string, fret) cell.
 * On the hit it leaves a labelled dot that fades over the note's duration.
 *
 * The board is instrument-parameterised: `kind="guitar"` draws a 6-string neck in
 * standard tuning, `kind="bass"` draws a 4-string bass neck (fewer, more widely
 * spaced, heavier strings). Everything else — geometry, falling notes, inlays —
 * is shared. The per-instrument tuning/colours/gauge come from getFretboard().
 *
 * Sibling to VideoPianoRoll: same rAF + timeRef + DPR scaffolding, but the
 * fretboard drawing + MIDI→position mapping live here (and in fretboardLayout).
 * Notes arrive as { time, duration, midi }; assignFretPositions() annotates each
 * with { string, fret } once.
 */

const VISIBLE_WINDOW = 4.0; // seconds of lookahead. The canvas now spans the full
// frame height (notes spawn behind the sheet), so this window covers a ~2× longer
// fall than the old lower-band-only roll → notes travel faster with wider gaps.
const GHOST_LEAD = 2.0; // only show a note's target ring in its last GHOST_LEAD
// seconds, so notes still hidden behind the score don't clutter the board.
const HIT_COLOR = '#012FA7'; // GrooveSheet brand blue (hit line)

function drawFretboard(ctx, w, fb, fretToX, stringToY, yTop, boardH, scale) {
  const { numStrings, fretCount } = fb;

  // board surface
  const grad = ctx.createLinearGradient(0, yTop, 0, yTop + boardH);
  grad.addColorStop(0, fb.board[0]);
  grad.addColorStop(1, fb.board[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, yTop, w, boardH);

  // hit line along the top of the board
  ctx.fillStyle = HIT_COLOR;
  ctx.fillRect(0, yTop - 4 * scale, w, 4 * scale);

  // fret wires (vertical) at each column boundary; nut (fret 0) is thicker.
  for (let f = 0; f <= fretCount; f += 1) {
    const x = fretBoundaryX(f);
    ctx.fillStyle = f === 0 ? '#e8e3d8' : 'rgba(200,200,190,0.45)';
    const wire = f === 0 ? 6 * scale : 2 * scale;
    ctx.fillRect(x - wire / 2, yTop, wire, boardH);
  }

  // inlay markers (between strings, vertically centred on the board)
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  const dotR = 7 * scale;
  for (const f of SINGLE_INLAYS) {
    if (f > fretCount) continue;
    ctx.beginPath();
    ctx.arc(fretToX(f), yTop + boardH / 2, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
  if (DOUBLE_INLAY <= fretCount) {
    const x = fretToX(DOUBLE_INLAY);
    ctx.beginPath(); ctx.arc(x, yTop + boardH * 0.3, dotR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, yTop + boardH * 0.7, dotR, 0, Math.PI * 2); ctx.fill();
  }

  // strings (horizontal). Low strings are thicker.
  for (let s = 0; s < numStrings; s += 1) {
    const y = stringToY(s);
    ctx.strokeStyle = 'rgba(220,220,210,0.55)';
    ctx.lineWidth = (1 + (numStrings - 1 - s) * fb.gauge) * scale; // s=0 (lowest) thickest
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // fret-number ruler in the strip just above the board: 0, 1, 2, … so the
  // viewer can read which fret each column is (positions, not note names).
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `600 ${Math.round(28 * scale)}px "Hubot Sans", Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (let f = 0; f <= fretCount; f += 1) {
    ctx.fillText(String(f), fretToX(f), yTop - 14 * scale);
  }
}

// column boundary x for fret f (f=0 is the nut). Uses the same unit scale as
// fretToX so wires and centres line up.
let _unitScale = 1;
function fretBoundaryX(f) {
  if (f === 0) return OPEN_COL_W * _unitScale;
  return (OPEN_COL_W + f * FRET_COL_W) * _unitScale;
}

export default function VideoFretboardRoll({ notes, timeRef, kind = 'guitar' }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!notes || !notes.length) return undefined;

    const fb = getFretboard(kind);
    const { numStrings, fretCount, stringColors } = fb;

    const allNotes = assignFretPositions(notes, fb)
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

      // Board keeps its old size/position (~454px of the 2160-tall frame) pinned
      // to the bottom; the canvas above it now runs all the way up behind the
      // sheet, so the falling area is much taller than the old lower band.
      const boardH = Math.round(h * 0.21);
      const yTop = h - boardH; // board occupies the bottom; falling area above
      const fallH = yTop;

      // fit fretCount frets + the nut column into the canvas width.
      const totalUnits = OPEN_COL_W + fretCount * FRET_COL_W;
      _unitScale = w / totalUnits;
      const fretToX = (f) => (f === 0
        ? (OPEN_COL_W / 2) * _unitScale
        : (OPEN_COL_W + (f - 0.5) * FRET_COL_W) * _unitScale);
      const stringToY = (s) => yTop + (s + 0.5) * (boardH / numStrings);

      // background (above the board)
      ctx.fillStyle = '#0c100c';
      ctx.fillRect(0, 0, w, fallH);

      drawFretboard(ctx, w, fb, fretToX, stringToY, yTop, boardH, scale);

      // Circle radius scales with the fret column so it's large and well spread;
      // clamped to the string spacing so landed dots don't smother the board.
      const colW = FRET_COL_W * _unitScale;
      const rowH = boardH / numStrings;
      const noteR = Math.min(colW * 0.40, rowH * 0.80);
      const labelFont = (r) => `700 ${Math.round(r * 0.95)}px "Hubot Sans", Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < allNotes.length; i += 1) {
        const note = allNotes[i];
        if (note.time - elapsed > VISIBLE_WINDOW) break; // not visible yet → stop
        if (note.time + note.duration < elapsed) continue; // fully passed
        const color = stringColors[note.string] || HIT_COLOR;
        const label = midiToPitchClass(note.midi);
        const xHit = fretToX(note.fret);
        const yHit = stringToY(note.string);

        if (note.time > elapsed) {
          const dt = note.time - elapsed;
          // Target marker on the board: a hollow ring at the destination cell so
          // the viewer can see where this note is heading before it lands. Only
          // shown in the note's last GHOST_LEAD seconds, brightening as the
          // falling circle approaches.
          if (dt <= GHOST_LEAD) {
            const approach = 1 - dt / GHOST_LEAD; // 0 far → 1 near
            ctx.globalAlpha = 0.18 + 0.5 * approach;
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(2, 3 * scale);
            ctx.beginPath();
            ctx.arc(xHit, yHit, noteR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = color;
            ctx.font = labelFont(noteR);
            ctx.fillText(label, xHit, yHit);
            ctx.globalAlpha = 1;
          }

          // falling: x fixed over the fret column, y reaches the cell at note.time
          const y = yHit - (dt / VISIBLE_WINDOW) * fallH;
          ctx.beginPath();
          ctx.fillStyle = color;
          ctx.arc(xHit, y, noteR, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = labelFont(noteR);
          ctx.fillText(label, xHit, y);
        } else {
          // landed: dot on the cell, fading over the note's duration
          const life = note.duration > 0 ? (elapsed - note.time) / note.duration : 1;
          const alpha = Math.max(0, 1 - life);
          const r = noteR * (1 + 0.25 * (1 - alpha));
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.fillStyle = color;
          ctx.arc(xHit, yHit, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = labelFont(noteR);
          ctx.fillText(label, xHit, yHit);
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
  }, [notes, timeRef, kind]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
