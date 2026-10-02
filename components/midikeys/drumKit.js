/**
 * The drum kit behind the Launchkey's pads on /midi-keyboard.
 *
 * Pads: in Drum mode the Launchkey MK4's 16 pads send notes on MIDI channel 10,
 * laid out (Programmer's Reference Guide, "Drum mode") as
 *
 *   top     40 41 42 43 | 48 49 50 51
 *   bottom  36 37 38 39 | 44 45 46 47
 *
 * and those numbers are the General MIDI drum map, so by default each pad plays
 * the GM sound for its note (36 kick, 38 snare, 42 closed hat ...). Any pad can
 * be reassigned to any voice from the page.
 *
 * Voices are synthesised with Web Audio rather than sampled: nothing to
 * download, no licensing question, and the hit starts the instant the pad is
 * struck. Every voice takes a `when` (AudioContext time) so the looper can
 * schedule a replayed hit ahead of time.
 */

export const DRUM_CHANNEL = 9; // channel 10, zero-based

export const PAD_ROWS = [
  [40, 41, 42, 43, 48, 49, 50, 51],
  [36, 37, 38, 39, 44, 45, 46, 47],
];

// `gm` is the General MIDI drum note the voice is exported as in a .mid file.
export const DRUM_VOICES = [
  { id: 'kick', label: 'Kick', gm: 36 },
  { id: 'kick808', label: '808 kick', gm: 35 },
  { id: 'snare', label: 'Snare', gm: 38 },
  { id: 'snare2', label: 'Bright snare', gm: 40 },
  { id: 'rim', label: 'Rim', gm: 37 },
  { id: 'clap', label: 'Clap', gm: 39 },
  { id: 'hatClosed', label: 'Closed hat', gm: 42 },
  { id: 'hatPedal', label: 'Pedal hat', gm: 44 },
  { id: 'hatOpen', label: 'Open hat', gm: 46 },
  { id: 'tom1', label: 'Floor tom', gm: 41, freq: 82 },
  { id: 'tom2', label: 'Floor tom 2', gm: 43, freq: 98 },
  { id: 'tom3', label: 'Low tom', gm: 45, freq: 117 },
  { id: 'tom4', label: 'Mid tom', gm: 47, freq: 139 },
  { id: 'tom5', label: 'High-mid tom', gm: 48, freq: 165 },
  { id: 'tom6', label: 'High tom', gm: 50, freq: 196 },
  { id: 'crash', label: 'Crash', gm: 49 },
  { id: 'ride', label: 'Ride', gm: 51 },
  { id: 'tambourine', label: 'Tambourine', gm: 54 },
  { id: 'cowbell', label: 'Cowbell', gm: 56 },
  { id: 'shaker', label: 'Shaker', gm: 70 },
  { id: 'clave', label: 'Clave', gm: 75 },
];

const VOICE_BY_ID = new Map(DRUM_VOICES.map((v) => [v.id, v]));
const VOICE_BY_GM = new Map(DRUM_VOICES.map((v) => [v.gm, v]));

export const voiceById = (id) => VOICE_BY_ID.get(id) || null;

/** Pad note -> voice id. Every pad starts on the GM sound for its note. */
export const DEFAULT_PAD_MAP = Object.fromEntries(
  PAD_ROWS.flat().map((note) => [note, (VOICE_BY_GM.get(note) || VOICE_BY_ID.get('snare')).id])
);

/** The voice a drum-channel note plays: the pad's assignment, else its GM sound. */
export function voiceForNote(padMap, note) {
  const assigned = padMap && padMap[note];
  if (assigned && VOICE_BY_ID.has(assigned)) return assigned;
  const gm = VOICE_BY_GM.get(note);
  return gm ? gm.id : null;
}

// ---- synthesis ------------------------------------------------------------

// 808 cymbal recipe: six square waves at inharmonic ratios, band-passed high.
const METAL_RATIOS = [2, 3, 4.16, 5.43, 6.79, 8.21];

/**
 * Build a drum synth on `ctx`, playing into `destination`.
 * Returns play(voiceId, when, velocity 1..127, dest?).
 */
export function createDrumSynth(ctx) {
  let noiseBuf = null;
  const noise = () => {
    if (!noiseBuf) {
      const n = Math.floor(ctx.sampleRate * 2);
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i += 1) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    return src;
  };

  // A gain node with a fast attack and exponential decay, already wired to `out`.
  const envGain = (out, t, peak, decay, attack = 0.002) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(out);
    return g;
  };

  const filter = (type, freq, q = 0.7) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  };

  const noiseHit = (out, t, peak, decay, chain) => {
    const src = noise();
    let node = src;
    for (const f of chain) { node.connect(f); node = f; }
    node.connect(envGain(out, t, peak, decay));
    // A random start in the shared buffer keeps repeated hits from sounding identical.
    src.start(t, Math.random() * Math.max(0, 1.9 - decay));
    src.stop(t + decay + 0.05);
  };

  const pitchDrop = (out, t, from, to, dropTime, peak, decay, type = 'sine') => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dropTime);
    o.connect(envGain(out, t, peak, decay));
    o.start(t);
    o.stop(t + decay + 0.05);
  };

  const tone = (out, t, freq, peak, decay, type = 'triangle') => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(envGain(out, t, peak, decay));
    o.start(t);
    o.stop(t + decay + 0.05);
  };

  const metal = (out, t, peak, decay, base = 40, hp = 7000, bp = 10000) => {
    const g = envGain(out, t, peak, decay);
    const high = filter('highpass', hp);
    const band = filter('bandpass', bp, 0.6);
    band.connect(high);
    high.connect(g);
    for (const r of METAL_RATIOS) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = base * r;
      o.connect(band);
      o.start(t);
      o.stop(t + decay + 0.05);
    }
  };

  const VOICES = {
    kick: (o, t, v) => {
      pitchDrop(o, t, 160, 48, 0.11, 1.0 * v, 0.42);
      noiseHit(o, t, 0.25 * v, 0.012, [filter('highpass', 2500)]);
    },
    kick808: (o, t, v) => pitchDrop(o, t, 120, 42, 0.09, 1.0 * v, 1.1),
    snare: (o, t, v) => {
      noiseHit(o, t, 0.55 * v, 0.2, [filter('highpass', 1200)]);
      tone(o, t, 185, 0.45 * v, 0.09);
      tone(o, t, 330, 0.2 * v, 0.06);
    },
    snare2: (o, t, v) => {
      noiseHit(o, t, 0.6 * v, 0.15, [filter('bandpass', 3800, 0.9)]);
      tone(o, t, 240, 0.35 * v, 0.07);
    },
    rim: (o, t, v) => {
      tone(o, t, 1700, 0.35 * v, 0.03, 'square');
      noiseHit(o, t, 0.3 * v, 0.02, [filter('bandpass', 3000, 2)]);
    },
    clap: (o, t, v) => {
      // three quick bursts then a short tail, the hand-clap smear
      for (const d of [0, 0.011, 0.023]) noiseHit(o, t + d, 0.5 * v, 0.03, [filter('bandpass', 1300, 0.9)]);
      noiseHit(o, t + 0.03, 0.45 * v, 0.17, [filter('bandpass', 1300, 0.9)]);
    },
    hatClosed: (o, t, v) => metal(o, t, 0.32 * v, 0.05),
    hatPedal: (o, t, v) => metal(o, t, 0.22 * v, 0.08, 38, 6000),
    hatOpen: (o, t, v) => metal(o, t, 0.3 * v, 0.38),
    crash: (o, t, v) => {
      metal(o, t, 0.25 * v, 1.6, 42, 5000, 8000);
      noiseHit(o, t, 0.3 * v, 1.4, [filter('highpass', 5000)]);
    },
    ride: (o, t, v) => {
      metal(o, t, 0.2 * v, 1.0, 50, 4500, 6500);
      tone(o, t, 2350, 0.06 * v, 0.6, 'sine');
    },
    tambourine: (o, t, v) => {
      metal(o, t, 0.18 * v, 0.22, 60, 8000, 11000);
      noiseHit(o, t, 0.2 * v, 0.18, [filter('highpass', 7000)]);
    },
    cowbell: (o, t, v) => {
      const band = filter('bandpass', 800, 1.5);
      band.connect(envGain(o, t, 0.5 * v, 0.3));
      for (const f of [540, 800]) {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = f;
        osc.connect(band);
        osc.start(t);
        osc.stop(t + 0.35);
      }
    },
    shaker: (o, t, v) => {
      const src = noise();
      const hp = filter('highpass', 6000);
      const g = envGain(o, t, 0.35 * v, 0.07, 0.02);
      src.connect(hp);
      hp.connect(g);
      src.start(t, Math.random());
      src.stop(t + 0.15);
    },
    clave: (o, t, v) => tone(o, t, 2500, 0.45 * v, 0.05, 'sine'),
  };

  return function play(id, when, velocity, destination) {
    const voice = voiceById(id);
    if (!voice) return;
    const t = Math.max(when, ctx.currentTime);
    // Pads are velocity sensitive; a soft curve keeps light taps audible.
    const v = Math.pow(Math.min(Math.max(velocity, 1), 127) / 127, 0.7);
    if (voice.freq) {
      pitchDrop(destination, t, voice.freq * 1.7, voice.freq, 0.08, 0.85 * v, 0.45);
      noiseHit(destination, t, 0.12 * v, 0.05, [filter('lowpass', 3000)]);
      return;
    }
    VOICES[id](destination, t, v);
  };
}
