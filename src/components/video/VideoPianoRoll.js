import React, { useEffect, useRef } from 'react';
import { Midi } from '@tonejs/midi';
import { drumVoice } from './videoSynth';

/**
 * VideoPianoRoll — falling-notes visualiser for the GrooveSheet social video
 * frame. Two modes:
 *
 *   - mode="piano" (default): 88-key piano roll, notes mapped by MIDI pitch.
 *     Used for pitched workers (transkun piano, fcpe/bassunet bass).
 *   - mode="drums": a 5-lane drum grid (Kick / Snare / Hi-Hat / Tom / Crash),
 *     each note placed in its instrument lane by GM percussion number. Drum
 *     hits are instantaneous, so blocks are a fixed height regardless of the
 *     note's notated duration.
 *
 * Time is driven externally by `timeRef` (seconds, looping); the component runs
 * its own rAF loop and reads `timeRef.current` each frame so the parent keeps a
 * single master clock without a per-frame React re-render.
 */

const NOTE_COLOR = '#012FA7'; // GrooveSheet brand blue (piano mode)
const VISIBLE_WINDOW = 3; // seconds of lookahead; smaller = taller notes + faster fall
const MIN_PITCH = 21;
const MAX_PITCH = 108;

// Drum lanes, left→right. Each GM voice family maps to one lane; openhat folds
// into Hi-Hat and ride into Crash so the common 5-piece kit stays legible.
const DRUM_LANES = [
  { key: 'kick', label: 'Kick', color: '#012FA7' },
  { key: 'snare', label: 'Snare', color: '#E8590C' },
  { key: 'hat', label: 'Hi-Hat', color: '#2F9E44' },
  { key: 'tom', label: 'Tom', color: '#9C36B5' },
  { key: 'crash', label: 'Crash', color: '#F08C00' },
];
const VOICE_TO_LANE = { kick: 0, snare: 1, hat: 2, openhat: 2, tom: 3, crash: 4, ride: 4 };

function laneForMidi(midi) {
  const idx = VOICE_TO_LANE[drumVoice(midi)];
  return idx == null ? 1 : idx;
}

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

function drawDrumBase(ctx, width, height, y) {
  const n = DRUM_LANES.length;
  const laneW = width / n;
  ctx.fillStyle = '#15171a';
  ctx.fillRect(0, y, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.round(height * 0.34)}px "Hubot Sans", Inter, system-ui, sans-serif`;
  for (let i = 0; i < n; i += 1) {
    const cx = (i + 0.5) * laneW;
    // lane swatch + label
    ctx.fillStyle = DRUM_LANES[i].color;
    ctx.fillRect(i * laneW + 4, y - 5, laneW - 8, 5); // hit line segment, lane-coloured
    ctx.globalAlpha = 0.18;
    ctx.fillRect(i * laneW, y, laneW, height);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.fillText(DRUM_LANES[i].label, cx, y + height / 2);
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(i * laneW, y); ctx.lineTo(i * laneW, y + height); ctx.stroke();
    }
  }
}

export default function VideoPianoRoll({ midiBuffer, notes, timeRef, mode = 'piano' }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const isDrums = mode === 'drums';

    // Prefer explicit notes (extracted from the same OSMD sheet / parsed MIDI →
    // perfectly synced). Fall back to parsing a raw MIDI buffer for back-compat.
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
    // the viewport via a CSS transform), not the 3840px layout box.
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

    const renderPiano = (w, h) => {
      const keyHeight = Math.round(h * 0.28);
      const fallHeight = h - keyHeight;
      const elapsed = (timeRef?.current ?? 0);

      ctx.fillStyle = '#0c100c';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(56, 224, 123, 0.06)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 52; i += 1) {
        const x = (i / 52) * w;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, fallHeight); ctx.stroke();
      }

      const nw = w / range;
      const r = Math.min(nw / 2, 8 * (w / 3840));
      const path = new Path2D();
      for (let i = 0; i < allNotes.length; i += 1) {
        const note = allNotes[i];
        if (note.time - elapsed > VISIBLE_WINDOW) break;
        if (note.time + note.duration < elapsed) continue;
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
      ctx.shadowBlur = 24 * (w / 3840);
      ctx.fill(path);
      ctx.shadowBlur = 0;

      drawKeyboard(ctx, w, keyHeight, fallHeight);
    };

    const renderDrums = (w, h) => {
      const baseHeight = Math.round(h * 0.12);
      const fallHeight = h - baseHeight;
      const elapsed = (timeRef?.current ?? 0);
      const n = DRUM_LANES.length;
      const laneW = w / n;
      const blockH = Math.max(10, Math.round(0.06 * fallHeight)); // fixed hit height
      const padX = Math.max(6, laneW * 0.12);

      ctx.fillStyle = '#0c100c';
      ctx.fillRect(0, 0, w, h);

      // faint lane grid
      for (let i = 1; i < n; i += 1) {
        const x = i * laneW;
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, fallHeight); ctx.stroke();
      }

      for (let i = 0; i < allNotes.length; i += 1) {
        const note = allNotes[i];
        if (note.time - elapsed > VISIBLE_WINDOW) break;
        if (note.time - elapsed < -0.25) continue; // hit already passed
        const lane = note.lane != null ? note.lane : laneForMidi(note.midi);
        const cy = fallHeight - ((note.time - elapsed) / VISIBLE_WINDOW) * fallHeight;
        const top = cy - blockH / 2;
        if (top > fallHeight || top + blockH < 0) continue;
        const color = DRUM_LANES[lane]?.color || NOTE_COLOR;
        const x = lane * laneW + padX;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 18 * (w / 3840);
        const p = new Path2D();
        p.roundRect(x, top, laneW - padX * 2, blockH, blockH / 2);
        ctx.fill(p);
      }
      ctx.shadowBlur = 0;

      drawDrumBase(ctx, w, baseHeight, fallHeight);
    };

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      if (isDrums) renderDrums(w, h); else renderPiano(w, h);
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [midiBuffer, notes, timeRef, mode]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}

export { DRUM_LANES, laneForMidi };
