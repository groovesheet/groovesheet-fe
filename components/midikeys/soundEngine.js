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
 *
 * The wheels act on the notes you are playing, not on loop replay: pitch bend
 * sets every live voice's `detune`, and the mod wheel sets the depth of one
 * shared vibrato LFO wired into each live voice's `detune` as it starts.
 */

// `sample` is the MusyngKite instrument; `filter` runs the keys through a
// resonant band-pass whose centre the Tone slider moves.
export const PIANO_SOUNDS = [
  { id: 'acoustic_grand_piano', label: 'Grand piano' },
  { id: 'bright_acoustic_piano', label: 'Bright piano' },
  { id: 'electric_piano_1', label: 'Electric piano' },
  { id: 'electric_piano_2', label: 'FM electric piano' },
  { id: 'honkytonk_piano', label: 'Honky-tonk' },
  { id: 'vibraphone', label: 'Vibraphone' },
  // Vibraphone bars are aluminium: the struck-metal tone, lightly driven,
  // narrowed to a ringing band and widened with a chorus, so it plays as an
  // electric instrument. On this sound the mod wheel is an auto-wah (see
  // setModulation), not just vibrato.
  { id: 'aluminium_bandpass', label: 'Aluminium band-pass', sample: 'vibraphone', filter: { q: 2.4, makeup: 2.2, drive: 2.5 } },
];

export const soundById = (id) => PIANO_SOUNDS.find((p) => p.id === id) || PIANO_SOUNDS[0];

export const DEFAULT_TONE_HZ = 1400;
const VIBRATO_HZ = 5.5;
// Mod wheel fully up. Plain sounds get vibrato only; the electric (filtered)
// sound gets a lighter vibrato plus a filter sweep, tremolo and a faster LFO.
const MOD = {
  plainVibratoCents: 70,
  electricVibratoCents: 30,
  wahCents: 2000, // band-pass centre swings this far each way (~1.7 octaves)
  wahExtraQ: 4, // and gets this much more resonant, so the sweep talks
  tremolo: 0.7, // volume dips by up to this fraction
  minRateHz: 1, // LFO rate with the wheel just off zero ...
  maxRateHz: 6, // ... and fully up
};

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
  // Keys enter here, then go straight to the piano bus, or through the
  // electric chain: drive -> band-pass -> makeup -> tremolo -> dry + chorus.
  const keysIn = ctx.createGain();
  keysIn.connect(pianoBus);
  const drive = ctx.createWaveShaper();
  drive.oversample = '2x';
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = DEFAULT_TONE_HZ;
  const makeup = ctx.createGain();
  const tremolo = ctx.createGain();
  drive.connect(bandpass);
  bandpass.connect(makeup);
  makeup.connect(tremolo);
  tremolo.connect(pianoBus);
  // Chorus: two short delays swaying in opposite directions, panned apart.
  const chorusLfo = ctx.createOscillator();
  chorusLfo.frequency.value = 0.7;
  chorusLfo.start();
  [[0.018, 0.0025, -0.6], [0.025, -0.0025, 0.6]].forEach(([base, sway, pan]) => {
    const d = ctx.createDelay(0.05);
    d.delayTime.value = base;
    const depth = ctx.createGain();
    depth.gain.value = sway;
    chorusLfo.connect(depth);
    depth.connect(d.delayTime);
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (p.pan) p.pan.value = pan;
    tremolo.connect(d);
    d.connect(wet);
    wet.connect(p);
    p.connect(pianoBus);
  });
  // The mod wheel's LFO for the electric sound: sweeps the band-pass (via its
  // detune, so the swing is in octaves) and dips the volume.
  const modLfo = ctx.createOscillator();
  modLfo.frequency.value = MOD.minRateHz;
  modLfo.start();
  const wah = ctx.createGain();
  wah.gain.value = 0;
  modLfo.connect(wah);
  wah.connect(bandpass.detune);
  const trem = ctx.createGain();
  trem.gain.value = 0;
  modLfo.connect(trem);
  trem.connect(tremolo.gain);
  let electric = null; // the current sound's filter settings, or null
  let modValue = 0;

  // Wheels: one vibrato LFO for all live voices, its depth set by the mod wheel.
  let bendCents = 0;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = VIBRATO_HZ;
  const vibrato = ctx.createGain();
  vibrato.gain.value = 0;
  lfo.connect(vibrato);
  lfo.start();
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

  const driveCurve = (k) => {
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    return curve;
  };

  function routeKeys(filter) {
    keysIn.disconnect();
    electric = filter || null;
    if (filter) {
      drive.curve = driveCurve(filter.drive || 1);
      makeup.gain.value = filter.makeup;
      keysIn.connect(drive);
    } else {
      keysIn.connect(pianoBus);
    }
    setModulation(modValue);
  }

  function loadPiano(soundId) {
    const sound = soundById(soundId);
    const token = ++loadToken;
    piano = null;
    routeKeys(sound.filter);
    report();
    Soundfont.instrument(ctx, sound.sample || sound.id, { soundfont: 'MusyngKite', format: 'mp3', destination: keysIn })
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
      const node = piano.play(midi, ctx.currentTime, { gain: pianoGain(vel), release: RELEASE_SEC });
      live.set(midi, node);
      wireWheels(node);
    } catch (e) { /* one dropped note must not break the keyboard */ }
  }

  // A new voice starts at the wheel's current bend and joins the vibrato.
  function wireWheels(node) {
    const src = node && node.source;
    if (!src || !src.detune) return;
    src.detune.value = bendCents;
    vibrato.connect(src.detune);
    src.addEventListener('ended', () => {
      try { vibrato.disconnect(src.detune); } catch (e) { /* already gone */ }
    });
  }

  /** Pitch wheel: -1..1 of `rangeSemis`, applied to every voice still sounding. */
  function setPitchBend(amount, rangeSemis) {
    bendCents = amount * rangeSemis * 100;
    const t = ctx.currentTime;
    live.forEach((node) => {
      const p = node.source && node.source.detune;
      if (p) p.setTargetAtTime(bendCents, t, 0.006);
    });
  }

  /**
   * Mod wheel, 0..127. Plain sounds: vibrato. The electric sound: a lighter
   * vibrato plus an auto-wah (band-pass swept and made more resonant) and
   * tremolo, all on one LFO that speeds up as the wheel goes up.
   */
  function setModulation(value) {
    modValue = Math.min(Math.max(value, 0), 127);
    const m = modValue / 127;
    const t = ctx.currentTime;
    const ramp = (param, v) => param.setTargetAtTime(v, t, 0.04);
    if (electric) {
      ramp(vibrato.gain, m * MOD.electricVibratoCents);
      ramp(wah.gain, m * MOD.wahCents);
      ramp(bandpass.Q, electric.q + m * MOD.wahExtraQ);
      ramp(trem.gain, (m * MOD.tremolo) / 2);
      ramp(tremolo.gain, 1 - (m * MOD.tremolo) / 2);
      ramp(modLfo.frequency, MOD.minRateHz + (MOD.maxRateHz - MOD.minRateHz) * m);
    } else {
      ramp(vibrato.gain, m * MOD.plainVibratoCents);
      ramp(wah.gain, 0);
      ramp(trem.gain, 0);
      ramp(tremolo.gain, 1);
    }
  }

  function setTone(hz) {
    bandpass.frequency.setTargetAtTime(Math.min(Math.max(hz, 100), 8000), ctx.currentTime, 0.03);
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
    setPitchBend,
    setModulation,
    setTone,
    close,
  };
}
