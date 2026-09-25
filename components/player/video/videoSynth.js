/**
 * videoSynth — tiny Web Audio synth for the Video2 quality-comparison harness.
 *
 * Video2 drives playback from a single master clock (natural sheet seconds,
 * looping) rather than OSMD's PlaybackManager, so there was never any audio.
 * This adds it: the master loop calls `noteOn(note)` as each note crosses the
 * hit line and we synthesize a short voice. Two voice families:
 *
 *   - pitched  (piano / bass): an oscillator at the note's frequency with a
 *     percussive AD envelope, length clamped to the note duration.
 *   - drums    (GM channel-10 pitches): purpose-built kick/snare/hi-hat/tom/
 *     crash voices (sine body, filtered noise, etc.) keyed off the GM number.
 *
 * Browsers block AudioContext until a user gesture, so the context starts
 * suspended; call resume() from a click handler (Video2's Play/Restart/🔊).
 */

import Soundfont from 'soundfont-player';

// General-MIDI percussion → voice family. Covers what ADTOF emits
// (35 kick, 38 snare, 42 closed hat, 47 tom, 49 crash) plus near neighbours.
const DRUM_VOICE = {
  35: 'kick', 36: 'kick',
  37: 'snare', 38: 'snare', 40: 'snare',
  42: 'hat', 44: 'hat', 46: 'openhat',
  41: 'tom', 43: 'tom', 45: 'tom', 47: 'tom', 48: 'tom', 50: 'tom',
  49: 'crash', 52: 'crash', 55: 'crash', 57: 'crash',
  51: 'ride', 53: 'ride', 59: 'ride',
};

function drumVoice(midi) {
  return DRUM_VOICE[midi] || 'snare';
}

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function createSynth(kind = 'piano') {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) {
    // no Web Audio (SSR / old browser): no-op synth so callers never branch.
    return { noteOn() {}, resume() {}, reset() {}, dispose() {}, setMuted() {}, get muted() { return true; } };
  }

  const ctx = new AC();
  // master bus with a gentle limiter-ish gain so dense drum hits don't clip.
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp);
  comp.connect(ctx.destination);

  let muted = false;
  let noiseBuf = null;

  // Real sampled instrument for pitched parts (a normal acoustic grand piano,
  // acoustic bass for bass). Loaded async from the FluidR3_GM soundfont; until
  // it lands (or if offline) we fall back to the struck-string synth below.
  let sf = null;
  let sfLoading = false;
  const wantSf = kind !== 'drums';
  const sfName = kind === 'bass'
    ? 'acoustic_bass'
    : kind === 'guitar'
      ? 'acoustic_guitar_steel'
      : 'acoustic_grand_piano';
  function loadSoundfont() {
    if (!wantSf || sf || sfLoading) return;
    sfLoading = true;
    try {
      Soundfont.instrument(ctx, sfName, { soundfont: 'FluidR3_GM', destination: master })
        .then((inst) => { sf = inst; })
        .catch(() => { sfLoading = false; });
    } catch (e) { sfLoading = false; }
  }
  loadSoundfont();

  function noise() {
    if (!noiseBuf) {
      const n = ctx.sampleRate * 1.0;
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i += 1) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    return src;
  }

  function env(gain, t0, peak, attack, release) {
    gain.gain.cancelScheduledValues(t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);
  }

  // Sampled grand piano if the soundfont is loaded; otherwise the synth fallback.
  function pitched(midi, durSec) {
    if (sf) {
      try {
        sf.play(midi, ctx.currentTime, { duration: Math.min(Math.max(durSec || 0.4, 0.18), 3.5), gain: 2.2 });
        return;
      } catch (e) { /* fall through to synth */ }
    }
    synthVoice(midi, durSec);
  }

  // Struck-string (piano-ish) fallback voice: a stack of slightly-inharmonic
  // partials with a sharp attack and an exponential decay to silence — used only
  // until the sampled soundfont loads (or if it can't be fetched).
  function synthVoice(midi, durSec) {
    const t0 = ctx.currentTime;
    const f = midiToFreq(midi);
    const g = ctx.createGain();
    g.connect(master);
    // longer ring for low notes; the notated duration only shortens it
    const ring = Math.min(2.4, Math.max(0.45, 1.7 - ((midi - 21) / 110) * 1.2));
    const decay = Math.min(ring, Math.max(0.35, (durSec || ring) + 0.25));
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.32, t0 + 0.004); // hammer attack
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    // gentle low-pass that closes as the note decays → mellow piano body
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(8000, f * 8), t0);
    lp.frequency.exponentialRampToValueAtTime(Math.max(600, f * 2), t0 + decay);
    lp.connect(g);
    const partials = [[1, 1.0], [2, 0.42], [3, 0.22], [4, 0.11], [6, 0.05]];
    for (let i = 0; i < partials.length; i += 1) {
      const [h, a] = partials[i];
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * h * (1 + 0.0007 * h * h); // mild inharmonicity
      const pg = ctx.createGain();
      pg.gain.value = a;
      o.connect(pg); pg.connect(lp);
      o.start(t0); o.stop(t0 + decay + 0.05);
    }
  }

  function drum(midi, vel = 1) {
    const t0 = ctx.currentTime;
    const v = drumVoice(midi);
    // velocity (0-1, from MIDI) scales hit loudness; floor keeps ghost notes
    // audible and vel=1 (workers without velocity, e.g. adtof) sounds as before.
    const dyn = 0.35 + 0.65 * Math.max(0, Math.min(1, vel));
    if (v === 'kick') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(150, t0);
      osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.12);
      env(g, t0, 0.9 * dyn, 0.004, 0.18);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + 0.24);
    } else if (v === 'snare') {
      const n = noise();
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 1400;
      const g = ctx.createGain();
      env(g, t0, 0.5 * dyn, 0.002, 0.16);
      n.connect(hp); hp.connect(g); g.connect(master);
      // a bit of tonal body
      const osc = ctx.createOscillator();
      osc.type = 'triangle'; osc.frequency.value = 200;
      const g2 = ctx.createGain();
      env(g2, t0, 0.18 * dyn, 0.002, 0.1);
      osc.connect(g2); g2.connect(master);
      n.start(t0); n.stop(t0 + 0.22);
      osc.start(t0); osc.stop(t0 + 0.14);
    } else if (v === 'hat' || v === 'openhat') {
      const n = noise();
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 7000;
      const g = ctx.createGain();
      const rel = v === 'openhat' ? 0.3 : 0.05;
      env(g, t0, 0.22 * dyn, 0.001, rel);
      n.connect(hp); hp.connect(g); g.connect(master);
      n.start(t0); n.stop(t0 + rel + 0.05);
    } else if (v === 'tom') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(220, t0);
      osc.frequency.exponentialRampToValueAtTime(110, t0 + 0.18);
      env(g, t0, 0.5 * dyn, 0.004, 0.22);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + 0.3);
    } else { // crash / ride
      const n = noise();
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 5000;
      const g = ctx.createGain();
      const rel = v === 'ride' ? 0.4 : 0.7;
      env(g, t0, 0.3 * dyn, 0.002, rel);
      n.connect(hp); hp.connect(g); g.connect(master);
      n.start(t0); n.stop(t0 + rel + 0.1);
    }
  }

  return {
    get muted() { return muted; },
    setMuted(m) { muted = !!m; },
    resume() { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); loadSoundfont(); },
    reset() { /* voices are fire-and-forget; nothing to clear */ },
    dispose() { try { ctx.close(); } catch (e) { /* ignore */ } },
    noteOn(note) {
      if (muted || !note) return;
      if (ctx.state === 'suspended') return; // wait for a gesture
      try {
        if (note.drum) drum(note.midi, note.velocity == null ? 1 : note.velocity);
        else pitched(note.midi, note.duration);
      } catch (e) { /* never let audio crash the render loop */ }
    },
  };
}

export { DRUM_VOICE, drumVoice };
