import Soundfont from 'soundfont-player';
import { createDrumSynth } from './drumKit';

/**
 * Audio for /midi-keyboard: a sampled piano (soundfont-player, MusyngKite, the
 * same samples /bistable and the score player use) plus the synthesised drum
 * kit, on one AudioContext.
 *
 * Two clocks meet here. The page and the looper keep time in
 * performance.now() seconds, which runs whether or not audio is unlocked; the
 * AudioContext has its own clock that only starts on a user gesture. Loop
 * events arrive stamped in page time and are converted at the moment they are
 * scheduled (`toCtx`), so the looper never depends on the audio being up.
 *
 * Loop playback is kept apart from live playing so Stop can silence the loop
 * mid-note without touching the keys you are holding: replayed piano notes are
 * tracked and stopped one by one, replayed drums go through a bus that is
 * faded out and swapped for a fresh one.
 */

export const PIANO_SOUNDS = [
  { id: 'acoustic_grand_piano', label: 'Grand piano' },
  { id: 'bright_acoustic_piano', label: 'Bright piano' },
  { id: 'electric_piano_1', label: 'Electric piano' },
  { id: 'electric_piano_2', label: 'FM electric piano' },
  { id: 'honkytonk_piano', label: 'Honky-tonk' },
  { id: 'vibraphone', label: 'Vibraphone' },
];

const RELEASE_SEC = 0.25; // damper fall on key-up
const nowSec = () => performance.now() / 1000;

export function createSoundEngine({ onStatus } = {}) {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) {
    onStatus?.('error', 'This browser has no Web Audio support.');
    return null;
  }

  const ctx = new AC({ latencyHint: 'interactive' });
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -8;
  comp.ratio.value = 4;
  comp.connect(ctx.destination);
  const master = ctx.createGain();
  master.connect(comp);
  const pianoBus = ctx.createGain();
  pianoBus.connect(master);
  const drumBus = ctx.createGain();
  drumBus.connect(master);

  const playDrum = createDrumSynth(ctx);
  let loopVolume = 0.9;
  let loopDrums = null;
  const freshLoopDrums = () => {
    const g = ctx.createGain();
    g.gain.value = loopVolume;
    g.connect(drumBus);
    return g;
  };
  loopDrums = freshLoopDrums();

  let piano = null;
  let loadToken = 0;
  let closed = false;
  const live = new Map(); // midi -> playing node (keys you are holding or sustaining)
  const replayed = new Set(); // { node, end } loop notes, scheduled or sounding

  const status = () => {
    if (closed) return 'closed';
    if (!piano) return 'loading';
    return ctx.state === 'running' ? 'ready' : 'locked';
  };
  const report = () => onStatus?.(status());

  function loadPiano(name) {
    const token = ++loadToken;
    piano = null;
    report();
    Soundfont.instrument(ctx, name, { soundfont: 'MusyngKite', format: 'mp3', destination: pianoBus })
      .then((inst) => {
        if (closed || token !== loadToken) return;
        piano = inst;
        report();
      })
      .catch((err) => {
        if (closed || token !== loadToken) return;
        onStatus?.('error', err?.message || 'Could not load the piano samples.');
      });
  }

  // Resume the context. Only succeeds from a user gesture; safe to call often.
  function unlock() {
    if (closed || ctx.state === 'running') return;
    ctx.resume().then(report).catch(() => { /* another gesture will retry */ });
  }
  ctx.onstatechange = report;

  const running = () => !closed && ctx.state === 'running';
  const toCtx = (pageSec) => ctx.currentTime + (pageSec - nowSec());
  const pianoGain = (vel) => 0.15 + 1.05 * (Math.min(Math.max(vel, 1), 127) / 127);

  function pianoOn(midi, vel) {
    if (!piano || !running()) return;
    const prev = live.get(midi);
    if (prev) { try { prev.stop(ctx.currentTime); } catch (e) { /* already stopped */ } }
    try {
      live.set(midi, piano.play(midi, ctx.currentTime, { gain: pianoGain(vel), release: RELEASE_SEC }));
    } catch (e) { /* one dropped note must not break the keyboard */ }
  }

  function pianoOff(midi) {
    const node = live.get(midi);
    if (!node) return;
    live.delete(midi);
    try { node.stop(ctx.currentTime); } catch (e) { /* already stopped */ }
  }

  function drum(voiceId, vel) {
    if (!running()) return;
    playDrum(voiceId, ctx.currentTime, vel, drumBus);
  }

  /** Schedule a loop event that was stamped in page seconds. */
  function scheduleLoopEvent(ev, atPage) {
    if (!running()) return;
    const when = Math.max(ctx.currentTime, toCtx(atPage));
    if (ev.type === 'drum') {
      playDrum(ev.voice, when, ev.vel, loopDrums);
      return;
    }
    if (!piano) return;
    const t = ctx.currentTime;
    replayed.forEach((r) => { if (r.end < t) replayed.delete(r); });
    try {
      const node = piano.play(ev.midi, when, {
        gain: pianoGain(ev.vel) * loopVolume,
        duration: ev.dur,
        release: RELEASE_SEC,
      });
      replayed.add({ node, end: when + ev.dur + RELEASE_SEC + 0.1 });
    } catch (e) { /* skip the note */ }
  }

  function stopLoop() {
    if (closed) return;
    const t = ctx.currentTime;
    replayed.forEach(({ node }) => { try { node.stop(t); } catch (e) { /* not started yet */ } });
    replayed.clear();
    const old = loopDrums;
    old.gain.setTargetAtTime(0, t, 0.02);
    setTimeout(() => { try { old.disconnect(); } catch (e) { /* gone */ } }, 300);
    loopDrums = freshLoopDrums();
  }

  function allNotesOff() {
    const t = ctx.currentTime;
    live.forEach((node) => { try { node.stop(t); } catch (e) { /* already stopped */ } });
    live.clear();
  }

  function setVolume(which, value) {
    const v = Math.min(Math.max(value, 0), 1.5);
    if (which === 'master') master.gain.value = v;
    else if (which === 'piano') pianoBus.gain.value = v;
    else if (which === 'drums') drumBus.gain.value = v;
    else if (which === 'loop') {
      loopVolume = v;
      loopDrums.gain.value = v;
    }
  }

  function close() {
    closed = true;
    live.clear();
    replayed.clear();
    try { ctx.close(); } catch (e) { /* already closed */ }
  }

  return {
    loadPiano,
    unlock,
    status,
    pianoOn,
    pianoOff,
    drum,
    scheduleLoopEvent,
    stopLoop,
    allNotesOff,
    setVolume,
    close,
  };
}
