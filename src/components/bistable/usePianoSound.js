import { useCallback, useEffect, useRef, useState } from 'react';
import Soundfont from 'soundfont-player';

/**
 * Acoustic-grand piano voice for the live keyboard.
 *
 * Same sound as the rest of GrooveSheet: `src/player/midiEngine.js` plays
 * through osmd-extended's BasicAudioPlayer, which is a wrapper around
 * soundfont-player loading MusyngKite GM samples from gleitz's midi-js CDN.
 * This hook talks to soundfont-player directly instead, for one reason —
 * BasicAudioPlayer.stopSound() stops *every* note on the channel ("Currently
 * stops all of the instrument's sounds because of implementation details"),
 * which would cut a held chord short the moment any one key came up. Playing
 * notes directly gives a per-note handle we can release independently.
 *
 * Autoplay policy: an AudioContext created outside a user gesture starts
 * suspended, and a MIDI message does not count as a gesture. So the context is
 * built up front (samples download immediately) but only resumed on the first
 * real click/keypress — `status` reports 'locked' until then so the UI can say so.
 */

const INSTRUMENT = 'acoustic_grand_piano';
const SOUNDFONT = 'MusyngKite'; // soundfont-player's default; matches BasicAudioPlayer
const MASTER_GAIN = 0.8;
const RELEASE_SEC = 0.25; // damper fall on key-up

export default function usePianoSound(enabled = true) {
  // 'loading' | 'locked' | 'ready' | 'error'
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  const ctxRef = useRef(null);
  const instrumentRef = useRef(null);
  const nodesRef = useRef(new Map()); // midi -> playing node

  // Resume the context. Safe to call repeatedly; only succeeds from a gesture.
  const unlock = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        if (instrumentRef.current) setStatus('ready');
      }).catch(() => { /* still locked; another gesture will retry */ });
    } else if (instrumentRef.current) {
      setStatus('ready');
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      setStatus('error');
      setError('This browser has no Web Audio support.');
      return undefined;
    }

    let cancelled = false;
    const ctx = new AC();
    ctxRef.current = ctx;
    const nodes = nodesRef.current; // stable handle for the cleanup below

    Soundfont.instrument(ctx, INSTRUMENT, { soundfont: SOUNDFONT, format: 'mp3' })
      .then((instrument) => {
        if (cancelled) return;
        instrumentRef.current = instrument;
        setStatus(ctx.state === 'running' ? 'ready' : 'locked');
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setError(err?.message || 'Could not load the piano samples.');
      });

    // Any gesture anywhere unlocks audio — including a click on the keyboard itself.
    const onGesture = () => unlock();
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);

    return () => {
      cancelled = true;
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      nodes.clear();
      instrumentRef.current = null;
      ctxRef.current = null;
      try { ctx.close(); } catch (e) { /* already closed */ }
    };
  }, [enabled, unlock]);

  const noteOn = useCallback((midi, velocity = 100) => {
    const instrument = instrumentRef.current;
    const ctx = ctxRef.current;
    if (!instrument || !ctx || ctx.state !== 'running') return;

    // Retrigger: a repeated note-on without a note-off (or a fast repeat) should
    // restart the sample rather than stack a second copy on top of the first.
    const existing = nodesRef.current.get(midi);
    if (existing) {
      try { existing.stop(ctx.currentTime); } catch (e) { /* already stopped */ }
    }

    try {
      const node = instrument.play(midi, ctx.currentTime, {
        gain: MASTER_GAIN * (Math.min(velocity, 127) / 127),
        release: RELEASE_SEC,
      });
      nodesRef.current.set(midi, node);
    } catch (e) { /* a single dropped note shouldn't break the keyboard */ }
  }, []);

  const noteOff = useCallback((midi) => {
    const ctx = ctxRef.current;
    const node = nodesRef.current.get(midi);
    if (!node) return;
    nodesRef.current.delete(midi);
    try { node.stop(ctx ? ctx.currentTime : 0); } catch (e) { /* already stopped */ }
  }, []);

  const allNotesOff = useCallback(() => {
    const ctx = ctxRef.current;
    const when = ctx ? ctx.currentTime : 0;
    nodesRef.current.forEach((node) => {
      try { node.stop(when); } catch (e) { /* already stopped */ }
    });
    nodesRef.current.clear();
  }, []);

  return { status, error, noteOn, noteOff, allNotesOff, unlock };
}
