import React, { useEffect, useRef } from 'react';
import { Midi } from '@tonejs/midi';

/**
 * VideoPianoRoll — falling-notes piano roll styled to match the GrooveSheet
 * social video frame (green glowing notes on a dark field, keyboard at the
 * base). Forked from PreviewPanel/tabs/PianoRollTab and restyled green.
 *
 * Time is driven externally by `timeRef`, a ref whose `.current` is the
 * current playback position in seconds. The component runs its own rAF draw
 * loop and reads `timeRef.current` each frame, so the parent can keep a single
 * master clock without forcing a React re-render per frame.
 */

const NOTE_COLOR = '#012FA7'; // GrooveSheet brand blue
const VISIBLE_WINDOW = 5; // seconds of lookahead; smaller = taller notes
const MIN_PITCH = 21;
const MAX_PITCH = 108;

function drawKeyboard(ctx, width, height, y) {
  const whiteKeyWidth = width / 52;

  ctx.fillStyle = '#f5f5ef';
  ctx.fillRect(0, y, width, height);

  let whiteIdx = 0;
  for (let p = MIN_PITCH; p <= MAX_PITCH; p += 1) {
    const isBlack = [1, 3, 6, 8, 10].includes(p % 12);
    if (!isBlack) {
      ctx.strokeStyle = '#c9c9c2';
      ctx.lineWidth = 1;
      ctx.strokeRect(whiteIdx * whiteKeyWidth, y, whiteKeyWidth, height);
      whiteIdx += 1;
    }
  }
  whiteIdx = 0;
  for (let p = MIN_PITCH; p <= MAX_PITCH; p += 1) {
    const isBlack = [1, 3, 6, 8, 10].includes(p % 12);
    if (!isBlack) { whiteIdx += 1; continue; }
    const blackX = whiteIdx * whiteKeyWidth - whiteKeyWidth * 0.3;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(blackX, y, whiteKeyWidth * 0.6, height * 0.62);
  }

  // green hit line above the keys
  ctx.fillStyle = NOTE_COLOR;
  ctx.fillRect(0, y - 5, width, 5);
}

export default function VideoPianoRoll({ midiBuffer, notes, timeRef }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Prefer explicit notes (extracted from the same OSMD sheet → perfectly
    // synced). Fall back to parsing a raw MIDI buffer for back-compat.
    let allNotes;
    if (notes && notes.length) {
      allNotes = notes;
    } else if (midiBuffer) {
      let midi;
      try { midi = new Midi(midiBuffer); } catch (e) { return undefined; }
      const totalDuration = Math.max(midi.duration || 1, 1);
      allNotes = midi.tracks.flatMap((t) => t.notes).filter((n) => n.time < totalDuration + 1);
    } else {
      return undefined;
    }

    // Sort once by start time so the draw loop can cull off-screen notes with
    // an early `break` instead of walking the full list every frame.
    allNotes = allNotes.slice().sort((a, b) => a.time - b.time);

    // Size the backing store to the *displayed* pixels (frame is downscaled to
    // the viewport via a CSS transform), not the 3840px layout box. Drawing a
    // full-4K surface at 60fps was the main source of lag. DPR capped at 2.
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round((rect.width || canvas.clientWidth) * dpr));
      const h = Math.max(1, Math.round((rect.height || canvas.clientHeight) * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
    };
    resize();
    window.addEventListener('resize', resize);

    const range = MAX_PITCH - MIN_PITCH;

    const render = () => {
      const elapsed = (timeRef?.current ?? 0);
      const w = canvas.width;
      const h = canvas.height;
      const keyHeight = Math.round(h * 0.28);
      const fallHeight = h - keyHeight;

      // dark field
      ctx.fillStyle = '#0c100c';
      ctx.fillRect(0, 0, w, h);

      // faint vertical lane grid
      ctx.strokeStyle = 'rgba(56, 224, 123, 0.06)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 52; i += 1) {
        const x = (i / 52) * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, fallHeight);
        ctx.stroke();
      }

      // falling notes — collect every visible note into ONE path and fill it
      // in a single call, so the (expensive) shadow blur is computed once per
      // frame instead of once per note. Notes are sorted by start time, so we
      // can stop as soon as a note is past the visible window.
      const nw = w / range;
      const r = Math.min(nw / 2, 8 * (w / 3840));
      const path = new Path2D();
      for (let i = 0; i < allNotes.length; i += 1) {
        const note = allNotes[i];
        if (note.time - elapsed > VISIBLE_WINDOW) break; // not yet on screen; rest are later
        if (note.time + note.duration < elapsed) continue; // already fallen past
        const startY = fallHeight - ((note.time - elapsed) / VISIBLE_WINDOW) * fallHeight;
        const endY = fallHeight - ((note.time + note.duration - elapsed) / VISIBLE_WINDOW) * fallHeight;
        const x = ((note.midi - MIN_PITCH) / range) * w;
        const top = Math.max(0, endY);
        const bottom = Math.min(fallHeight, startY);
        if (bottom - top <= 0) continue;
        path.roundRect(x + 1, top, nw - 2, bottom - top, r);
      }
      ctx.fillStyle = NOTE_COLOR;
      ctx.shadowColor = NOTE_COLOR;
      ctx.shadowBlur = 24 * (w / 3840); // scale glow with backing resolution
      ctx.fill(path);
      ctx.shadowBlur = 0;

      drawKeyboard(ctx, w, keyHeight, fallHeight);

      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [midiBuffer, notes, timeRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
