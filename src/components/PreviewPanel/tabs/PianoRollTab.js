import React, { useEffect, useRef } from 'react';
import { Midi } from '@tonejs/midi';

const NOTE_COLOR = '#012FA7';
const KEY_HEIGHT = 110;
const DEFAULT_DURATION = 10;
const VISIBLE_WINDOW = 10;

function midiToCanvasNote(note, canvasWidth, fallHeightPx, durationSec) {
  const minPitch = 21;
  const maxPitch = 108;
  const pitchRange = maxPitch - minPitch;
  const x = ((note.midi - minPitch) / pitchRange) * canvasWidth;
  const noteWidth = canvasWidth / pitchRange;
  const yEnd = ((note.time) / durationSec) * fallHeightPx;
  const yStart = ((note.time + note.duration) / durationSec) * fallHeightPx;
  return { x, noteWidth, yStart, yEnd };
}

function drawPianoKeyboard(ctx, width, height, y) {
  const minPitch = 21;
  const maxPitch = 108;
  const pitchRange = maxPitch - minPitch;
  const whiteKeyWidth = width / 52;

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, y, width, height);

  let whiteIdx = 0;
  for (let p = minPitch; p <= maxPitch; p += 1) {
    const isBlack = [1, 3, 6, 8, 10].includes(p % 12);
    if (!isBlack) {
      ctx.strokeStyle = '#ccc';
      ctx.strokeRect(whiteIdx * whiteKeyWidth, y, whiteKeyWidth, height);
      whiteIdx += 1;
    }
  }
  whiteIdx = 0;
  for (let p = minPitch; p <= maxPitch; p += 1) {
    const isBlack = [1, 3, 6, 8, 10].includes(p % 12);
    if (!isBlack) { whiteIdx += 1; continue; }
    const blackX = whiteIdx * whiteKeyWidth - whiteKeyWidth * 0.3;
    ctx.fillStyle = '#222';
    ctx.fillRect(blackX, y, whiteKeyWidth * 0.6, height * 0.65);
  }

  ctx.fillStyle = '#7a3030';
  ctx.fillRect(0, y - 4, width, 4);
}

export default function PianoRollTab({
  midiBuffer,
  isLoading,
  error,
  // Preferred: shared playback transport (src/player/transport.js). The
  // playhead is read straight off transport.getPosition() each frame, so the
  // roll, sheet cursor, and bottom bar all share one clock.
  transport,
  // Legacy fallback when no transport is provided: prop-driven clock.
  currentTime = 0,
  isPlaying = false,
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const transportRef = useRef(transport);
  const syncRef = useRef({ at: 0, time: currentTime, playing: false });

  useEffect(() => { transportRef.current = transport; }, [transport]);

  useEffect(() => {
    syncRef.current = {
      at: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
      time: currentTime,
      playing: isPlaying,
    };
  }, [currentTime, isPlaying]);

  useEffect(() => {
    if (!midiBuffer || !canvasRef.current) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let midi;
    try { midi = new Midi(midiBuffer); } catch (e) { return undefined; }

    const totalDuration = Math.max(midi.duration || DEFAULT_DURATION, DEFAULT_DURATION);
    const allNotes = midi.tracks.flatMap((t) => t.notes).filter((n) => n.time < totalDuration);

    const resize = () => {
      canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
      canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      let elapsed;
      const t = transportRef.current;
      if (t) {
        elapsed = t.getPosition();
      } else {
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const sync = syncRef.current;
        elapsed = sync.playing ? sync.time + (now - sync.at) / 1000 : sync.time;
      }

      const w = canvas.width;
      const h = canvas.height;
      const fallHeight = h - KEY_HEIGHT;

      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 1;
      for (let i = 0; i < 52; i += 1) {
        const x = (i / 52) * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, fallHeight);
        ctx.stroke();
      }

      ctx.fillStyle = NOTE_COLOR;
      ctx.shadowColor = NOTE_COLOR;
      ctx.shadowBlur = 12;
      allNotes.forEach((note) => {
        const noteStartY = fallHeight - ((note.time - elapsed) / VISIBLE_WINDOW) * fallHeight;
        const noteEndY = fallHeight - ((note.time + note.duration - elapsed) / VISIBLE_WINDOW) * fallHeight;
        if (noteStartY < 0 || noteEndY > fallHeight) return;
        const minP = 21; const maxP = 108; const range = maxP - minP;
        const x = ((note.midi - minP) / range) * w;
        const nw = w / range;
        const top = Math.max(0, noteEndY);
        const bottom = Math.min(fallHeight, noteStartY);
        ctx.fillRect(x, top, nw - 1, bottom - top);
      });
      ctx.shadowBlur = 0;

      drawPianoKeyboard(ctx, w, KEY_HEIGHT, fallHeight);

      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [midiBuffer]);

  return (
    <div className="piano-roll-tab">
      {isLoading && <div className="preview-loading">Loading MIDI…</div>}
      {error && <div className="preview-error">{error}</div>}
      <canvas ref={canvasRef} className="piano-roll-canvas" />
    </div>
  );
}
