/**
 * midiEngine.js — MIDI synth engine for the piano-roll tab (plain JS, no React).
 *
 * Implements the transport engine contract (see src/player/transport.js):
 *   { play(atSec), pause(), seek(sec), readTime() }
 * plus { setMasterVolume(v01), getDuration(), getNotes(), dispose() }.
 *
 * Sound: reuses osmd-extended's soundfont player (BasicAudioPlayer):
 *   - new BasicAudioPlayer() creates its own AudioContext (player.ac)
 *   - await player.open([])                 // seeds channel volumes + piano
 *   - await player.setSound(ch, programNo)  // loads/binds a GM soundfont
 *   - player.playSound(ch, midiKey, vol01, lengthMs) // plays immediately
 * If the soundfont player fails to initialize (offline, CDN down), a minimal
 * triangle-wave WebAudio synth takes over — no new npm deps.
 *
 * Scheduling: a ~100ms lookahead window polled every 25ms. Notes entering the
 * window are armed with setTimeout for their exact offset, so trigger jitter
 * is timer-level (~1-4ms) instead of window-level. The engine's clock is
 * anchored to AudioContext.currentTime:
 *   position = startedAtPos + (ctx.currentTime - startedAtCtx)
 */
import { Midi } from '@tonejs/midi';
import { BasicAudioPlayer } from 'osmd-extended';

const LOOKAHEAD_SEC = 0.1;
const TICK_MS = 25;
const PERCUSSION_SOUND_ID = 128; // MidiInstrument.Percussion in osmd-extended

/** Minimal WebAudio synth with the same playSound() shape as BasicAudioPlayer. */
function createFallbackSynth() {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  return {
    ac: ctx,
    playSound(_channel, key, volume, lengthMs) {
      if (key >= 128) return;
      const t0 = ctx.currentTime;
      const dur = Math.max(0.05, lengthMs / 1000);
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 440 * Math.pow(2, (key - 69) / 12);
      const env = ctx.createGain();
      const peak = Math.max(0.001, Math.min(1, volume)) * 0.3;
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.exponentialRampToValueAtTime(peak, t0 + 0.01); // attack
      env.gain.exponentialRampToValueAtTime(peak * 0.6, t0 + Math.min(0.15, dur)); // decay
      env.gain.setTargetAtTime(0.0001, t0 + dur, 0.04); // release
      osc.connect(env);
      env.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.3);
    },
    stopSound() { /* one-shot envelopes die on their own */ },
    setVolume(_channel, v) {
      master.gain.value = Math.max(0, Math.min(1.5, v));
    },
    close() {
      try { ctx.close(); } catch (e) { /* ignore */ }
    },
  };
}

/**
 * @param {Object} opts
 * @param {ArrayBuffer|Uint8Array} opts.midiBuffer  raw .mid bytes
 * @param {Function} [opts.onReady]  called when the synth is ready (after first play())
 * @param {Function} [opts.onError]  called with (Error) if MIDI parsing fails
 */
export function createMidiEngine({ midiBuffer, onReady, onError } = {}) {
  // --- parse ---------------------------------------------------------------
  let midi = null;
  let notes = []; // [{ time, duration, midi, velocity, channel }] sorted by time
  let channels = []; // [{ channel, program, isPercussion }]
  let duration = 0;
  try {
    midi = new Midi(midiBuffer);
    duration = midi.duration || 0;
    const tracksWithNotes = midi.tracks.filter((t) => t.notes && t.notes.length);
    channels = tracksWithNotes.map((t, i) => ({
      channel: i,
      program: t.instrument?.number ?? 0,
      isPercussion: Boolean(t.instrument?.percussion) || t.channel === 9,
    }));
    notes = tracksWithNotes
      .flatMap((t, i) =>
        t.notes.map((n) => ({
          time: n.time,
          duration: n.duration,
          midi: n.midi,
          velocity: n.velocity,
          channel: i,
        }))
      )
      .sort((a, b) => a.time - b.time);
  } catch (err) {
    if (onError) { try { onError(err instanceof Error ? err : new Error(String(err))); } catch (e) { /* ignore */ } }
  }

  // --- synth (lazy, autoplay policy) ----------------------------------------
  let player = null; // BasicAudioPlayer or fallback synth
  let playerPromise = null;
  let masterVol = 0.78;

  const applyVolume = () => {
    if (!player) return;
    channels.forEach(({ channel }) => {
      try { player.setVolume(channel, 0.8 * masterVol); } catch (e) { /* ignore */ }
    });
  };

  const ensurePlayer = () => {
    if (playerPromise) return playerPromise;
    playerPromise = (async () => {
      try {
        const p = new BasicAudioPlayer();
        await p.open([], 16);
        for (const { channel, program, isPercussion } of channels) {
          // eslint-disable-next-line no-await-in-loop
          await p.setSound(channel, isPercussion ? PERCUSSION_SOUND_ID : program);
        }
        player = p;
      } catch (err) {
        // Soundfont CDN unreachable or AudioContext refused — degrade to the
        // built-in synth so the piano roll still makes sound.
        console.warn('[midiEngine] BasicAudioPlayer unavailable, using fallback synth:', err);
        player = createFallbackSynth();
      }
      if (player.ac && player.ac.state === 'suspended') {
        try { await player.ac.resume(); } catch (e) { /* ignore */ }
      }
      applyVolume();
      if (onReady) { try { onReady(); } catch (e) { /* ignore */ } }
    })();
    return playerPromise;
  };

  // --- clock + scheduler -----------------------------------------------------
  let playing = false;
  let startedAtPos = 0;
  let startedAtCtx = 0;
  let pausedPos = 0;
  let disposed = false;
  let cmdSeq = 0;

  let intervalId = null;
  let nextIdx = 0; // next un-scheduled note index
  const pendingTimeouts = new Set();

  const ctxNow = () => (player && player.ac ? player.ac.currentTime : 0);

  const currentPos = () => {
    if (!playing || !player) return pausedPos;
    return startedAtPos + Math.max(0, ctxNow() - startedAtCtx);
  };

  const clearPending = () => {
    pendingTimeouts.forEach((id) => clearTimeout(id));
    pendingTimeouts.clear();
  };

  const stopAllSound = () => {
    if (!player) return;
    channels.forEach(({ channel }) => {
      try { player.stopSound(channel, 0); } catch (e) { /* ignore */ }
    });
  };

  const firstNoteAtOrAfter = (sec) => {
    let lo = 0;
    let hi = notes.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (notes[mid].time < sec) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  const schedulerTick = () => {
    if (!playing || !player) return;
    const pos = currentPos();
    const horizon = pos + LOOKAHEAD_SEC;
    while (nextIdx < notes.length && notes[nextIdx].time < horizon) {
      const note = notes[nextIdx];
      nextIdx += 1;
      const delayMs = Math.max(0, (note.time - pos) * 1000);
      const id = setTimeout(() => {
        pendingTimeouts.delete(id);
        if (!playing || !player) return;
        try {
          player.playSound(note.channel, note.midi, note.velocity, Math.max(50, note.duration * 1000));
        } catch (e) { /* ignore single-note failures */ }
      }, delayMs);
      pendingTimeouts.add(id);
    }
  };

  const startScheduler = (atSec) => {
    clearPending();
    nextIdx = firstNoteAtOrAfter(atSec);
    startedAtPos = atSec;
    startedAtCtx = ctxNow();
    playing = true;
    if (intervalId == null) intervalId = setInterval(schedulerTick, TICK_MS);
    schedulerTick();
  };

  const stopScheduler = () => {
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    clearPending();
  };

  // --- public API --------------------------------------------------------------
  return {
    id: 'midi',

    async play(atSec) {
      if (disposed || !notes.length) return;
      const seq = ++cmdSeq;
      const at = Number.isFinite(atSec) ? atSec : pausedPos;
      pausedPos = at;
      await ensurePlayer();
      if (disposed || seq !== cmdSeq) return; // superseded by pause/seek
      if (player.ac && player.ac.state === 'suspended') {
        try { await player.ac.resume(); } catch (e) { /* ignore */ }
        if (disposed || seq !== cmdSeq) return;
      }
      // Use pausedPos (not `at`): a seek() issued while loading updates it.
      startScheduler(pausedPos);
    },

    pause() {
      if (disposed) return;
      cmdSeq += 1;
      pausedPos = currentPos();
      playing = false;
      stopScheduler();
      stopAllSound();
    },

    seek(sec) {
      if (disposed) return;
      const target = Math.max(0, Number(sec) || 0);
      if (playing && player) {
        cmdSeq += 1;
        stopAllSound();
        startScheduler(target);
      } else {
        pausedPos = target;
        startedAtPos = target;
      }
    },

    readTime() {
      if (disposed) return null;
      if (!player) return pausedPos;
      return currentPos();
    },

    setMasterVolume(v) {
      masterVol = Math.max(0, Math.min(1, Number(v) || 0));
      applyVolume();
    },

    getDuration() {
      return duration;
    },

    /** Parsed note list, e.g. for a piano-roll renderer. */
    getNotes() {
      return notes;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      cmdSeq += 1;
      playing = false;
      stopScheduler();
      stopAllSound();
      if (player) {
        try { player.close(); } catch (e) { /* ignore */ }
        if (player.ac && typeof player.ac.close === 'function') {
          try { player.ac.close(); } catch (e) { /* ignore */ }
        }
      }
      player = null;
      notes = [];
    },
  };
}

export default createMidiEngine;
