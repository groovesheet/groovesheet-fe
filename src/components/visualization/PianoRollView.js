import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Midi } from '@tonejs/midi';
import { downloadWorkflowFile } from '../../utils/api';
import config from '../../config';
import StatusMessage from '../ui/StatusMessage';
import SkeletonPanel from '../ui/SkeletonPanel';

const API_BASE_URL = config.apiBaseUrl;

const MIDI_KEY_MAP = {
  drums: 'adtof_plus_drums_quantized_midi',
  piano: 'transkun_v2_piano_midi',
  bass: 'fcpe_bass_midi',
  jazz_bass: 'bassunet_jazz_bass_midi',
};

// Piano keyboard constants
const MIN_MIDI_NOTE = 21; // A0
const MAX_MIDI_NOTE = 108; // C8

// Note colors
const NOTE_COLORS = [
  '#00e676', '#00c853', '#69f0ae', '#00e676',
  '#00bfa5', '#1de9b6', '#64ffda', '#a7ffeb',
  '#00e676', '#00c853', '#69f0ae', '#00e676',
];

function isBlackKey(midiNote) {
  const n = midiNote % 12;
  return [1, 3, 6, 8, 10].includes(n);
}

function getNoteY(midiNote, noteHeight) {
  // Map MIDI note to y position (higher notes = higher on screen)
  return (MAX_MIDI_NOTE - midiNote) * noteHeight;
}

// `midiUrl` is the library-asset path (public tracks on /explore); `jobId` +
// `selectedInstrument` is the workflow path (a signed-in user's own run). The
// drawing below is identical either way — only where the bytes come from
// differs, so the two callers share one renderer.
export default function PianoRollView({ jobId, selectedInstrument, getToken, zoom, midiUrl }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const midiDataRef = useRef(null);
  const scrollRef = useRef({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const animFrameRef = useRef(null);

  // Fetch and parse MIDI data
  useEffect(() => {
    let cancelled = false;

    const loadMidi = async () => {
      const fileKey = midiUrl ? null : MIDI_KEY_MAP[selectedInstrument];
      if (!midiUrl && !fileKey) {
        setError('Piano roll is not available for this instrument type.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        let arrayBuffer;
        if (midiUrl) {
          const resp = await fetch(midiUrl);
          if (!resp.ok) throw new Error(`MIDI fetch failed (${resp.status})`);
          if (cancelled) return;
          arrayBuffer = await resp.arrayBuffer();
        } else {
          const result = await downloadWorkflowFile(API_BASE_URL, jobId, fileKey, getToken);
          if (!result) {
            throw new Error('MIDI file not found. It may not have been generated yet.');
          }
          if (cancelled) return;
          arrayBuffer = await result.blob.arrayBuffer();
        }
        const midi = new Midi(arrayBuffer);
        midiDataRef.current = midi;
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('MIDI load error:', err);
          setError(err.message || 'Failed to load MIDI file.');
          setLoading(false);
        }
      }
    };

    loadMidi();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, selectedInstrument, midiUrl]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const midi = midiDataRef.current;
    if (!canvas || !container || !midi) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const zoomLevel = zoom || 1.0;

    // Layout
    const pianoWidth = 52; // Width of piano keyboard on left
    const rollWidth = width - pianoWidth;
    const noteRange = MAX_MIDI_NOTE - MIN_MIDI_NOTE;
    const noteHeight = (height / noteRange) * zoomLevel;
    const pixelsPerSecond = 120 * zoomLevel;

    // Calculate total duration
    const totalDuration = midi.duration || 30;
    const scrollX = scrollRef.current.x;
    const scrollY = scrollRef.current.y;

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.save();
    ctx.translate(pianoWidth, 0);
    ctx.beginPath();
    for (let note = MIN_MIDI_NOTE; note <= MAX_MIDI_NOTE; note++) {
      const y = getNoteY(note, noteHeight) + scrollY;
      if (y < -noteHeight || y > height) continue;

      // Alternating row background for black keys
      if (isBlackKey(note)) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, y, rollWidth, noteHeight);
      }

      // Horizontal grid line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(rollWidth, y);
    }
    ctx.stroke();

    // Vertical beat lines
    const bpm = midi.header.tempos.length > 0 ? midi.header.tempos[0].bpm : 120;
    const secondsPerBeat = 60 / bpm;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let t = 0; t < totalDuration; t += secondsPerBeat) {
      const x = t * pixelsPerSecond + scrollX;
      if (x < 0 || x > rollWidth) continue;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    ctx.stroke();

    // Draw notes
    midi.tracks.forEach((track) => {
      track.notes.forEach((note) => {
        const x = note.time * pixelsPerSecond + scrollX;
        const w = Math.max(note.duration * pixelsPerSecond, 2);
        const y = getNoteY(note.midi, noteHeight) + scrollY;

        // Skip if off-screen
        if (x + w < 0 || x > rollWidth || y + noteHeight < 0 || y > height) return;

        const colorIdx = note.midi % 12;
        const alpha = 0.4 + (note.velocity * 0.6);
        ctx.fillStyle = NOTE_COLORS[colorIdx];
        ctx.globalAlpha = alpha;

        // Note rectangle with slight rounding
        const radius = Math.min(2, noteHeight / 2);
        ctx.beginPath();
        ctx.roundRect(x, y + 1, w, noteHeight - 2, radius);
        ctx.fill();

        // Glow effect for active notes
        ctx.shadowColor = NOTE_COLORS[colorIdx];
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    });
    ctx.globalAlpha = 1;
    ctx.restore();

    // Draw piano keyboard on left
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, pianoWidth, height);

    for (let note = MIN_MIDI_NOTE; note <= MAX_MIDI_NOTE; note++) {
      const y = getNoteY(note, noteHeight) + scrollY;
      if (y + noteHeight < 0 || y > height) continue;

      if (isBlackKey(note)) {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, y, pianoWidth * 0.65, noteHeight);
      } else {
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(0, y, pianoWidth, noteHeight);
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(0, y, pianoWidth, noteHeight);
      }

      // C note labels
      if (note % 12 === 0) {
        ctx.fillStyle = isBlackKey(note) ? '#888' : '#333';
        ctx.font = '9px sans-serif';
        ctx.fillText(`C${Math.floor(note / 12) - 1}`, 2, y + noteHeight - 2);
      }
    }

    // Separator line
    ctx.strokeStyle = '#3d3b3e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pianoWidth, 0);
    ctx.lineTo(pianoWidth, height);
    ctx.stroke();
  }, [zoom]);

  // Redraw on data load or zoom change
  useEffect(() => {
    if (!loading && !error && midiDataRef.current) {
      draw();
    }
  }, [loading, error, zoom, draw]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(draw);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [draw]);

  // Handle scroll/pan
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    scrollRef.current.x -= e.deltaX;
    scrollRef.current.y -= e.deltaY;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  if (error) {
    return (
      <div className="viz-content-area viz-dark-bg">
        <div className="viz-error"><StatusMessage variant="error">{error}</StatusMessage></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="viz-content-area viz-dark-bg">
        <div className="viz-loading"><SkeletonPanel count={1} height={260} /></div>
      </div>
    );
  }

  return (
    <div className="viz-content-area viz-dark-bg" ref={containerRef} style={{ cursor: 'grab' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
