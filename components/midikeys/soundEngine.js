import Soundfont from 'soundfont-player';
import { createDrumSynth } from './drumKit';
import { createFxChain } from './fxChain';
import { GM_FAMILIES, sampleUrl } from './instruments';

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
 * Levels: live keys and drums have their own faders. A loop note carries
 * the instrument and the level it was played at, and replays through its
 * layer's gain (layer fader x Loop fader), so a quiet piano take and a loud
 * trumpet overdub keep their balance whatever is selected or set now. The
 * engine keeps a few instruments loaded at once for that.
 *
 * The wheels act on the notes you are playing, not on loop replay: pitch bend
 * sets every live voice's `detune`, and the mod wheel sets the depth of one
 * shared vibrato LFO wired into each live voice's `detune` as it starts.
 */

// Sounds of our own, beyond General MIDI. Each one is listed in the Sound menu
// right after the GM instrument it is built on (`after`), so every sound
// appears once, under its family. `sample` is the soundfont instrument;
// `filter` runs the keys through the electric chain, whose band-pass centre
// the Tone slider moves.
const CUSTOM_SOUNDS = [
  // Vibraphone bars are aluminium: the struck-metal tone, lightly driven,
  // narrowed to a ringing band and widened with a chorus, so it plays as an
  // electric instrument. On this sound the mod wheel is an auto-wah (see
  // setModulation), not just vibrato.
  {
    id: 'aluminium_bandpass',
    label: 'Aluminium band-pass',
    after: 'vibraphone',
    sample: 'vibraphone',
    filter: { q: 2.4, makeup: 2.2, drive: 2.5 },
  },
];

/** The Sound menu: the GM families, with the custom sounds slotted in. */
export const SOUND_FAMILIES = GM_FAMILIES.map((f) => ({
  family: f.family,
  sounds: f.instruments.flatMap((inst) => [
    { ...inst, number: String(inst.program + 1) },
    ...CUSTOM_SOUNDS.filter((c) => c.after === inst.id).map((c) => ({ ...c, number: null })),
  ]),
}));

/** Every sound in menu order: what Track left / right step through. */
export const ALL_SOUNDS = SOUND_FAMILIES.flatMap((f) => f.sounds);

const findSound = (id) => ALL_SOUNDS.find((x) => x.id === id) || null;

export const DEFAULT_SOUND = 'acoustic_grand_piano';
export const isKnownSound = (id) => findSound(id) != null;
export const soundById = (id) => findSound(id) || findSound(DEFAULT_SOUND);

/** The sound `step` places along the menu from `id`, wrapping round. */
export function stepSound(id, step) {
  const i = Math.max(0, ALL_SOUNDS.findIndex((x) => x.id === id));
  const n = ALL_SOUNDS.length;
  return ALL_SOUNDS[(((i + step) % n) + n) % n].id;
}

/** "57. Trumpet", or the plain name for a sound of our own. */
export const soundTitle = (sound) => (sound.number ? `${sound.number}. ${sound.label}` : sound.label);

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

/**
 * `limiter: true` (/midi-keyboard) adds a boost before the compressor
 * (setBoost, in dB) and a peak limiter after it, so the page can be pushed
 * far louder without clipping. Without it (/launchpad) the chain is as built.
 */
export function createSoundEngine({ onStatus, limiter = false } = {}) {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) {
    onStatus?.('error', 'This browser has no Web Audio support.');
    return null;
  }

  const ctx = new AC({ latencyHint: 'interactive' });
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -8;
  comp.ratio.value = 4;
  const output = ctx.createGain(); // the page's boost
  output.connect(comp);
  if (limiter) {
    // A brick wall just under full scale: catches what the boost pushes over.
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -1;
    lim.knee.value = 0;
    lim.ratio.value = 20;
    lim.attack.value = 0.002;
    lim.release.value = 0.12;
    comp.connect(lim);
    // The limiter's attack lets the first millisecond of a hit through, which
    // a +30 dB boost turns into clipping (measured peaks 1.2), so a soft
    // clipper rounds anything over 0.85 off below full scale. The shaper only
    // reads -1..1, so it works on half-scale input and scales back up.
    const half = ctx.createGain();
    half.gain.value = 0.5;
    const clip = ctx.createWaveShaper();
    const n = 2048;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      const v = ((i / (n - 1)) * 2 - 1) * 2; // the real level, -2..2
      const a = Math.abs(v);
      curve[i] = a < 0.85 ? v : Math.sign(v) * (0.85 + 0.13 * Math.tanh((a - 0.85) / 0.13));
    }
    clip.curve = curve;
    clip.oversample = 'none'; // oversampling's filter rang past full scale on snare noise
    lim.connect(half);
    half.connect(clip);
    clip.connect(ctx.destination);
  } else {
    comp.connect(ctx.destination);
  }
  const master = ctx.createGain();
  master.connect(output);
  // The keys (live and replayed) go through the stage-piano effects; the
  // drums stay dry, as a drum machine beside the keyboard would.
  const fx = createFxChain(ctx, master);
  const pianoBus = ctx.createGain();
  pianoBus.connect(fx.input);
  // Two ways into the keys' effects: straight (directIn), or through the
  // electric chain (drive -> band-pass -> makeup -> tremolo -> dry + chorus)
  // for sounds that have a `filter`. Both are always wired; each note is sent
  // down the one its sound needs.
  const directIn = ctx.createGain();
  directIn.connect(pianoBus);
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

  // Live levels: the Keys fader, on both ways in.
  const liveDirect = ctx.createGain();
  liveDirect.connect(directIn);
  const liveElectric = ctx.createGain();
  liveElectric.connect(drive);

  // Loop levels: one gain per layer and destination, = layer fader x Loop fader.
  const LAYER_FADERS = 5; // layers 5 and up share the last fader
  const layerLevel = Array(LAYER_FADERS).fill(1);
  let loopLevel = 1;
  let layerGains = new Map(); // `${layer}|${dest}` -> GainNode
  const destNode = (dest) => (dest === 'drums' ? master : dest === 'electric' ? drive : directIn);
  const layerSlot = (layer) => Math.min(Math.max(layer || 0, 0), LAYER_FADERS - 1);
  function layerGain(layer, dest) {
    const key = `${layerSlot(layer)}|${dest}`;
    let g = layerGains.get(key);
    if (!g) {
      g = ctx.createGain();
      g.gain.value = layerLevel[layerSlot(layer)] * loopLevel;
      g.connect(destNode(dest));
      layerGains.set(key, g);
    }
    return g;
  }
  const refreshLayerGains = () => {
    layerGains.forEach((g, key) => {
      const slot = Number(key.split('|')[0]);
      g.gain.setTargetAtTime(layerLevel[slot] * loopLevel, ctx.currentTime, 0.02);
    });
  };

  // Loaded instruments, `${sample}|${set}` -> { inst, promise, used }. The
  // current one plays the keys; the others are what loop layers were played on.
  const MAX_INSTRUMENTS = 6;
  const instruments = new Map();
  let piano = null; // the current instrument, once loaded
  let current = null; // { sound, set }
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

  function configureElectric(filter) {
    if (!filter) return;
    drive.curve = driveCurve(filter.drive || 1);
    makeup.gain.value = filter.makeup;
  }

  const instKey = (sound, set) => `${sound.sample || sound.id}|${set}`;

  // Load (or reuse) an instrument. Least recently used ones beyond the cap
  // are dropped; a loop note on a dropped one reloads it and plays next pass.
  function instrument(sound, set) {
    const key = instKey(sound, set);
    let entry = instruments.get(key);
    if (!entry) {
      entry = { inst: null, used: 0 };
      entry.promise = Soundfont.instrument(ctx, sound.sample || sound.id, {
        nameToUrl: (name) => sampleUrl(name, set),
        destination: directIn, // every note is re-routed as it starts
      }).then((inst) => { entry.inst = inst; return inst; });
      entry.promise.catch(() => instruments.delete(key));
      instruments.set(key, entry);
      if (instruments.size > MAX_INSTRUMENTS) {
        const keep = current ? instKey(current.sound, current.set) : null;
        const oldest = [...instruments.entries()]
          .filter(([k]) => k !== key && k !== keep)
          .sort((a, b) => a[1].used - b[1].used)[0];
        if (oldest) instruments.delete(oldest[0]);
      }
    }
    entry.used = performance.now();
    return entry;
  }

  function loadPiano(soundId, sampleSet) {
    const sound = soundById(soundId);
    const token = ++loadToken;
    current = { sound, set: sampleSet };
    electric = sound.filter || null;
    configureElectric(sound.filter);
    setModulation(modValue);
    const entry = instrument(sound, sampleSet);
    piano = entry.inst;
    report();
    if (piano) return;
    entry.promise
      .then((inst) => {
        if (closed || token !== loadToken) return;
        piano = inst;
        report();
      })
      .catch((err) => {
        if (closed || token !== loadToken) return;
        onStatus?.('error', err?.message || 'Could not load the instrument samples.');
      });
  }

  // Send a note that just started to `dest` instead of its player's output.
  const reroute = (node, dest) => {
    try { node.disconnect(); node.connect(dest); } catch (e) { /* leave it where it is */ }
  };

  // Resume the context. Only succeeds from a user gesture; safe to call often.
  function unlock() {
    if (closed || ctx.state === 'running') return;
    ctx.resume().then(report).catch(() => { /* another gesture will retry */ });
  }
  ctx.onstatechange = report;
  // Try straight away too: where the browser allows audio without a click
  // (Chrome started with --autoplay-policy=no-user-gesture-required, as the
  // MIDI Keyboard launcher does, or a site it already trusts), the page comes
  // up with sound on. Elsewhere this is refused and the first click does it.
  ctx.resume().then(report).catch(() => { /* needs a gesture */ });

  const running = () => !closed && ctx.state === 'running';
  const toCtx = (pageSec) => ctx.currentTime + (pageSec - nowSec());
  const pianoGain = (vel) => 0.15 + 1.05 * (Math.min(Math.max(vel, 1), 127) / 127);

  function pianoOn(midi, vel) {
    if (!piano || !running()) return;
    const prev = live.get(midi);
    if (prev) { try { prev.stop(ctx.currentTime); } catch (e) { /* already stopped */ } }
    try {
      const node = piano.play(midi, ctx.currentTime, { gain: pianoGain(vel), release: RELEASE_SEC });
      reroute(node, current && current.sound.filter ? liveElectric : liveDirect);
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

  /**
   * Schedule a loop event that was stamped in page seconds, at the level and
   * on the instrument it was recorded with (takes from before that was
   * recorded fall back to the current sound at full level).
   */
  function scheduleLoopEvent(ev, atPage) {
    if (!running()) return;
    const when = Math.max(ctx.currentTime, toCtx(atPage));
    const level = Number.isFinite(ev.level) ? ev.level : 1;
    if (ev.type === 'drum') {
      const g = ctx.createGain();
      g.gain.value = level;
      g.connect(layerGain(ev.layer, 'drums'));
      playDrum(ev.voice, when, ev.vel, g);
      setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, (when - ctx.currentTime + 3) * 1000);
      return;
    }
    const sound = ev.sound ? soundById(ev.sound) : current && current.sound;
    if (!sound) return;
    const entry = instrument(sound, ev.set || (current && current.set));
    if (!entry.inst) return; // still loading: it plays from the next pass
    const t = ctx.currentTime;
    replayed.forEach((r) => { if (r.end < t) replayed.delete(r); });
    try {
      const node = entry.inst.play(ev.midi, when, {
        gain: pianoGain(ev.vel) * level,
        duration: ev.dur,
        release: RELEASE_SEC,
      });
      reroute(node, layerGain(ev.layer, sound.filter ? 'electric' : 'direct'));
      replayed.add({ node, end: when + ev.dur + RELEASE_SEC + 0.1 });
    } catch (e) { /* skip the note */ }
  }

  function stopLoop() {
    if (closed) return;
    const t = ctx.currentTime;
    replayed.forEach(({ node }) => { try { node.stop(t); } catch (e) { /* not started yet */ } });
    replayed.clear();
    const old = layerGains;
    old.forEach((g) => g.gain.setTargetAtTime(0, t, 0.02));
    setTimeout(() => old.forEach((g) => { try { g.disconnect(); } catch (e) { /* gone */ } }), 300);
    layerGains = new Map();
  }

  function allNotesOff() {
    const t = ctx.currentTime;
    live.forEach((node) => { try { node.stop(t); } catch (e) { /* already stopped */ } });
    live.clear();
  }

  /**
   * A fader's gain: 'keys', 'drums', 'loop', 'master' or 'layer0'..'layer4'.
   */
  function setLevel(which, gain) {
    const v = Math.min(Math.max(gain, 0), 2);
    const t = ctx.currentTime;
    const ramp = (param) => param.setTargetAtTime(v, t, 0.02);
    if (which === 'master') ramp(master.gain);
    else if (which === 'keys') { ramp(liveDirect.gain); ramp(liveElectric.gain); }
    else if (which === 'drums') ramp(drumBus.gain);
    else if (which === 'loop') { loopLevel = v; refreshLayerGains(); }
    else if (/^layer\d$/.test(which)) { layerLevel[layerSlot(Number(which.slice(5)))] = v; refreshLayerGains(); }
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
    isRunning: running, // audio is on (a drums-only page has no samples to wait for)
    pianoOn,
    pianoOff,
    drum,
    scheduleLoopEvent,
    stopLoop,
    allNotesOff,
    setLevel,
    setPitchBend,
    setModulation,
    setTone,
    setFx: (id, value) => { if (!closed) fx.set(id, value); },
    /** The page boost in dB (0 = as built); only with `limiter`. */
    setBoost: (db) => {
      if (closed || !limiter) return;
      output.gain.setTargetAtTime(Math.pow(10, Math.min(Math.max(db, 0), 30) / 20), ctx.currentTime, 0.05);
    },
    close,
  };
}
