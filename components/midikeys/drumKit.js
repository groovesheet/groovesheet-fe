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
 * Pages: the 16 pads flip through three pages of the GM percussion map, 16
 * notes apart, so page 2 plays notes 52-67 (cymbals and hand drums) and page 3
 * plays 68-83 (shakers, whistles, guiros, blocks and bells).
 *
 * The Launchkey's own page arrows beside the pads send no message: they move
 * the pads a whole bank of 16 notes (measured on the MK4 49: one press down
 * and the first pad sent 20 instead of 36). So a pad's place in its bank says
 * which pad it is, and a change of bank is a press of those arrows, which
 * steps the page the same way (see stepPage), wrapping round the three pages.
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

export const PAD_PAGE_SIZE = 16;
export const PAD_PAGES = ['Kit', 'Cymbals and hand drums', 'Shakers, whistles and bells'];

/** The pad rows of a page: page 0 is the Launchkey's own layout, the others 16 notes up each. */
export const padRowsFor = (page) => PAD_ROWS.map((row) => row.map((n) => n + page * PAD_PAGE_SIZE));

const PAD_BASE = 36; // the first pad's note in the Launchkey's default bank
const mod = (a, n) => ((a % n) + n) % n;

/** Which bank of 16 a pad note is in, counted from the default 36-51 (below it is negative). */
export const hardwareBank = (note) => Math.floor((note - PAD_BASE) / PAD_PAGE_SIZE);

/** The note a pad plays on a page: the pad's place in its bank, on that page. */
export const pageNote = (note, page) => PAD_BASE + mod(page || 0, PAD_PAGES.length) * PAD_PAGE_SIZE + mod(note - PAD_BASE, PAD_PAGE_SIZE);

/** The page after moving `steps` pages, wrapping round. */
export const stepPage = (page, steps) => mod(page + steps, PAD_PAGES.length);

// `gm` is the General MIDI drum note the voice is exported as in a .mid file.
// `trimDb` evens out a voice that sits too loud against the rest of the kit.
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
  { id: 'tom1', label: 'Floor tom', gm: 41, freq: 82, trimDb: -2 }, // its low thud read louder than the kit
  { id: 'tom2', label: 'Floor tom 2', gm: 43, freq: 98 },
  { id: 'tom3', label: 'Low tom', gm: 45, freq: 117 },
  { id: 'tom4', label: 'Mid tom', gm: 47, freq: 139 },
  { id: 'tom5', label: 'High-mid tom', gm: 48, freq: 165 },
  { id: 'tom6', label: 'High tom', gm: 50, freq: 196 },
  { id: 'crash', label: 'Crash', gm: 49 },
  { id: 'ride', label: 'Ride', gm: 51 },
  // page 2: notes 52-67
  { id: 'china', label: 'China cymbal', gm: 52 },
  { id: 'rideBell', label: 'Ride bell', gm: 53 },
  { id: 'tambourine', label: 'Tambourine', gm: 54 },
  { id: 'splash', label: 'Splash', gm: 55 },
  { id: 'cowbell', label: 'Cowbell', gm: 56 },
  { id: 'crash2', label: 'Crash 2', gm: 57 },
  { id: 'vibraslap', label: 'Vibraslap', gm: 58 },
  { id: 'ride2', label: 'Ride 2', gm: 59 },
  { id: 'bongoHigh', label: 'High bongo', gm: 60 },
  { id: 'bongoLow', label: 'Low bongo', gm: 61 },
  { id: 'congaMute', label: 'Muted conga', gm: 62 },
  { id: 'congaOpen', label: 'Open conga', gm: 63 },
  { id: 'congaLow', label: 'Low conga', gm: 64 },
  { id: 'timbaleHigh', label: 'High timbale', gm: 65 },
  { id: 'timbaleLow', label: 'Low timbale', gm: 66 },
  { id: 'agogoHigh', label: 'High agogo', gm: 67 },
  // page 3: notes 68-83
  { id: 'agogoLow', label: 'Low agogo', gm: 68 },
  { id: 'cabasa', label: 'Cabasa', gm: 69 },
  { id: 'shaker', label: 'Shaker', gm: 70 },
  { id: 'whistleShort', label: 'Short whistle', gm: 71 },
  { id: 'whistleLong', label: 'Long whistle', gm: 72 },
  { id: 'guiroShort', label: 'Short guiro', gm: 73 },
  { id: 'guiroLong', label: 'Long guiro', gm: 74 },
  { id: 'clave', label: 'Clave', gm: 75 },
  { id: 'blockHigh', label: 'High wood block', gm: 76 },
  { id: 'blockLow', label: 'Low wood block', gm: 77 },
  { id: 'cuicaMute', label: 'Muted cuica', gm: 78 },
  { id: 'cuicaOpen', label: 'Open cuica', gm: 79 },
  { id: 'triangleMute', label: 'Muted triangle', gm: 80 },
  { id: 'triangleOpen', label: 'Open triangle', gm: 81 },
  { id: 'eggShaker', label: 'Egg shaker', gm: 82 },
  { id: 'jingle', label: 'Jingle bells', gm: 83 },
];

const VOICE_BY_ID = new Map(DRUM_VOICES.map((v) => [v.id, v]));
const VOICE_BY_GM = new Map(DRUM_VOICES.map((v) => [v.gm, v]));

export const voiceById = (id) => VOICE_BY_ID.get(id) || null;

/** Pad note -> voice id, for every page. Every pad starts on the GM sound for its note. */
export const DEFAULT_PAD_MAP = Object.fromEntries(
  PAD_PAGES.flatMap((_, page) => padRowsFor(page).flat())
    .map((note) => [note, (VOICE_BY_GM.get(note) || VOICE_BY_ID.get('snare')).id])
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

  // A hand drum: a short pitch dip on the skin plus a touch of slap.
  const skin = (out, t, v, freq, decay) => {
    pitchDrop(out, t, freq * 1.18, freq, 0.025, 0.7 * v, decay);
    noiseHit(out, t, 0.12 * v, 0.015, [filter('bandpass', freq * 6, 1)]);
  };

  // A timbale: a ringing shell over a bright stick crack.
  const timbale = (out, t, v, freq) => {
    pitchDrop(out, t, freq * 1.06, freq, 0.02, 0.5 * v, 0.32, 'triangle');
    tone(out, t, freq * 2.3, 0.12 * v, 0.2, 'sine');
    noiseHit(out, t, 0.3 * v, 0.08, [filter('bandpass', 4200, 1)]);
  };

  // An agogo bell: a pure tone with an inharmonic partial.
  const bell = (out, t, v, freq) => {
    tone(out, t, freq, 0.35 * v, 0.4, 'sine');
    tone(out, t, freq * 2.76, 0.12 * v, 0.22, 'sine');
  };

  // A shaken noise burst with a slower attack than a hit.
  const shake = (out, t, peak, decay, attack, hp) => {
    const src = noise();
    const f = filter('highpass', hp);
    src.connect(f);
    f.connect(envGain(out, t, peak, decay, attack));
    src.start(t, Math.random());
    src.stop(t + attack + decay + 0.05);
  };

  // A pea whistle: a high sine with a fast warble.
  const whistle = (out, t, v, length) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 2450;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 32;
    const depth = ctx.createGain();
    depth.gain.value = 90;
    lfo.connect(depth);
    depth.connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22 * v, t + 0.015);
    g.gain.setValueAtTime(0.22 * v, t + length);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length + 0.04);
    o.connect(g);
    g.connect(out);
    for (const n of [o, lfo]) { n.start(t); n.stop(t + length + 0.1); }
  };

  // A guiro: a run of quick ticks, the stick over the ridges.
  const scrape = (out, t, v, ticks, gap) => {
    for (let i = 0; i < ticks; i += 1) {
      noiseHit(out, t + i * gap, 0.35 * v, 0.012, [filter('bandpass', 2800, 3)]);
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

    // ---- page 2: cymbals and hand drums
    china: (o, t, v) => {
      metal(o, t, 0.28 * v, 1.3, 36, 3200, 5200);
      noiseHit(o, t, 0.3 * v, 1.0, [filter('bandpass', 4200, 1.2)]);
    },
    rideBell: (o, t, v) => {
      tone(o, t, 1180, 0.22 * v, 1.1, 'sine');
      tone(o, t, 2960, 0.1 * v, 0.6, 'sine');
      metal(o, t, 0.08 * v, 0.5, 52, 5000, 8000);
    },
    splash: (o, t, v) => {
      metal(o, t, 0.24 * v, 0.55, 48, 6500, 9500);
      noiseHit(o, t, 0.28 * v, 0.45, [filter('highpass', 6500)]);
    },
    crash2: (o, t, v) => {
      metal(o, t, 0.25 * v, 1.9, 37, 4500, 7000);
      noiseHit(o, t, 0.3 * v, 1.7, [filter('highpass', 4500)]);
    },
    vibraslap: (o, t, v) => {
      // a fast rattle that slows and dies away
      let at = t;
      for (let i = 0; i < 14; i += 1) {
        noiseHit(o, at, 0.4 * v * Math.pow(0.82, i), 0.025, [filter('bandpass', 2600, 4)]);
        at += 0.028 + i * 0.003;
      }
    },
    ride2: (o, t, v) => {
      metal(o, t, 0.18 * v, 1.3, 46, 4000, 6000);
      tone(o, t, 2100, 0.05 * v, 0.8, 'sine');
    },
    bongoHigh: (o, t, v) => skin(o, t, v, 400, 0.16),
    bongoLow: (o, t, v) => skin(o, t, v, 290, 0.2),
    congaMute: (o, t, v) => {
      skin(o, t, v, 330, 0.06);
      noiseHit(o, t, 0.25 * v, 0.03, [filter('bandpass', 1800, 1.5)]);
    },
    congaOpen: (o, t, v) => skin(o, t, v, 300, 0.32),
    congaLow: (o, t, v) => skin(o, t, v, 210, 0.36),
    timbaleHigh: (o, t, v) => timbale(o, t, v, 520),
    timbaleLow: (o, t, v) => timbale(o, t, v, 390),
    agogoHigh: (o, t, v) => bell(o, t, v, 940),

    // ---- page 3: shakers, whistles and bells
    agogoLow: (o, t, v) => bell(o, t, v, 660),
    cabasa: (o, t, v) => shake(o, t, 0.32 * v, 0.1, 0.012, 5000),
    whistleShort: (o, t, v) => whistle(o, t, v, 0.1),
    whistleLong: (o, t, v) => whistle(o, t, v, 0.42),
    guiroShort: (o, t, v) => scrape(o, t, v, 6, 0.018),
    guiroLong: (o, t, v) => scrape(o, t, v, 20, 0.022),
    blockHigh: (o, t, v) => {
      tone(o, t, 1850, 0.45 * v, 0.05, 'sine');
      tone(o, t, 4300, 0.1 * v, 0.02, 'sine');
    },
    blockLow: (o, t, v) => {
      tone(o, t, 1250, 0.45 * v, 0.06, 'sine');
      tone(o, t, 2950, 0.1 * v, 0.025, 'sine');
    },
    cuicaMute: (o, t, v) => pitchDrop(o, t, 1100, 760, 0.08, 0.35 * v, 0.1),
    cuicaOpen: (o, t, v) => pitchDrop(o, t, 480, 900, 0.22, 0.35 * v, 0.26),
    triangleMute: (o, t, v) => {
      tone(o, t, 4100, 0.16 * v, 0.07, 'sine');
      tone(o, t, 6300, 0.07 * v, 0.05, 'sine');
    },
    triangleOpen: (o, t, v) => {
      tone(o, t, 4100, 0.14 * v, 1.4, 'sine');
      tone(o, t, 6300, 0.06 * v, 1.0, 'sine');
      tone(o, t, 8900, 0.03 * v, 0.6, 'sine');
    },
    eggShaker: (o, t, v) => shake(o, t, 0.28 * v, 0.13, 0.03, 4500),
    jingle: (o, t, v) => {
      // a few bells struck a hair apart
      for (const d of [0, 0.012, 0.03, 0.05]) metal(o, t + d, 0.1 * v, 0.4, 64 + d * 400, 7500, 10500);
      noiseHit(o, t, 0.15 * v, 0.3, [filter('highpass', 8000)]);
    },
  };

  return function play(id, when, velocity, destination) {
    const voice = voiceById(id);
    if (!voice) return;
    const t = Math.max(when, ctx.currentTime);
    // Pads are velocity sensitive; a soft curve keeps light taps audible.
    const v = Math.pow(Math.min(Math.max(velocity, 1), 127) / 127, 0.7) * Math.pow(10, (voice.trimDb || 0) / 20);
    if (voice.freq) {
      pitchDrop(destination, t, voice.freq * 1.7, voice.freq, 0.08, 0.85 * v, 0.45);
      noiseHit(destination, t, 0.12 * v, 0.05, [filter('lowpass', 3000)]);
      return;
    }
    VOICES[id](destination, t, v);
  };
}
