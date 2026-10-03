/**
 * The keys' effects on /midi-keyboard, laid out like a stage piano's panel
 * (the Nord Stage: Amp/EQ, Effect 1, Effect 2, Delay, Reverb, plus a second
 * page of modulation and dynamics) and played from the Launchkey's knobs.
 *
 * Two pages of eight. The eight knobs send Control Changes 21-28
 * (Programmer's Reference Guide, encoder indices 15h-1Ch, absolute 0-127) and
 * turn whichever page is showing, knob n -> slot n, on any channel. The
 * Launchkey's own page buttons beside the knobs send nothing in Standalone
 * mode, so the page is switched on screen or from a learnt button.
 *
 * Any effect can also be learnt to a control of its own; a learnt control
 * turns that effect whatever page is showing.
 *
 * Every value here is 0..1. EQ knobs sit at 0.5 for flat, like a centred pot.
 */

const pct = (v) => `${Math.round(v * 100)}%`;

export const FX = [
  // page 1: the sound
  { id: 'drive', label: 'Drive', group: 'Amp', page: 0, def: 0, fmt: pct },
  { id: 'treble', label: 'Treble', group: 'EQ', page: 0, def: 0.5, fmt: (v) => db((v - 0.5) * 24) },
  { id: 'bass', label: 'Bass', group: 'EQ', page: 0, def: 0.5, fmt: (v) => db((v - 0.5) * 24) },
  { id: 'tremolo', label: 'Tremolo', group: 'Effect 1', page: 0, def: 0, fmt: pct },
  { id: 'phaser', label: 'Phaser', group: 'Effect 2', page: 0, def: 0, fmt: pct },
  { id: 'delay', label: 'Amount', group: 'Delay', page: 0, def: 0, fmt: pct },
  { id: 'delayTime', label: 'Time', group: 'Delay', page: 0, def: 0.4, fmt: (v) => `${Math.round(delaySeconds(v) * 1000)} ms` },
  { id: 'reverb', label: 'Amount', group: 'Reverb', page: 0, def: 0.15, fmt: pct },
  // page 2: movement and dynamics
  { id: 'chorus', label: 'Chorus', group: 'Effect 2', page: 1, def: 0, fmt: pct },
  { id: 'flanger', label: 'Flanger', group: 'Effect 2', page: 1, def: 0, fmt: pct },
  { id: 'pan', label: 'Auto-pan', group: 'Effect 1', page: 1, def: 0, fmt: pct },
  { id: 'ring', label: 'Ring mod', group: 'Effect 1', page: 1, def: 0, fmt: pct },
  { id: 'rate', label: 'Rate', group: 'Effect 1', page: 1, def: 0.5, fmt: (v) => `${modRateScale(v).toFixed(2)}x` },
  { id: 'comp', label: 'Comp', group: 'Dynamics', page: 1, def: 0, fmt: pct },
  { id: 'lowpass', label: 'Low-pass', group: 'Filter', page: 1, def: 1, fmt: (v) => hz(lowpassHz(v)) },
  { id: 'feedback', label: 'Feedback', group: 'Delay', page: 1, def: 0.45, fmt: pct },
];

export const PAGE_COUNT = 2;
export const PAGE_NAMES = ['Amp · EQ · Delay · Reverb', 'Modulation · Dynamics'];
// The same, short and plain ASCII for the Launchkey's screen (18 characters).
export const PAGE_SCREEN_NAMES = ['Amp EQ Delay Verb', 'Mod + Dynamics'];
export const fxOnPage = (page) => FX.filter((f) => f.page === page);

function db(x) {
  const r = Math.round(x * 10) / 10;
  if (Math.abs(r) < 0.05) return '0 dB';
  return `${r > 0 ? '+' : ''}${r.toFixed(1)} dB`;
}

function hz(f) {
  return f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)} kHz` : `${Math.round(f)} Hz`;
}

export const delaySeconds = (v) => 0.06 + v * 0.94;
export const lowpassHz = (v) => 200 * Math.pow(100, v); // 200 Hz .. 20 kHz, logarithmic
// The Rate knob scales every effect LFO together: 0.25x .. 4x, 1x at 0.5.
export const modRateScale = (v) => Math.pow(16, v - 0.5);

export const DEFAULT_FX = Object.fromEntries(FX.map((f) => [f.id, f.def]));

// No effect is learnt to a control of its own until you teach it one.
export const DEFAULT_KNOBS = FX.map((f) => ({ id: f.id, cc: null, channel: null }));

export const FIRST_KNOB_CC = 21;
export const KNOB_COUNT = 8;

/**
 * Which effect a Control Change turns, or null. A learnt control wins;
 * otherwise CC 21-28 turn slots 1-8 of the page showing. CC 1 (mod wheel),
 * 64 (sustain) and the channel-mode messages (120+) are never knobs.
 * `slot` is the knob position, for the Launchkey's per-knob screen.
 */
export function knobForMessage(knobs, data, page = 0) {
  const status = data[0];
  if ((status & 0xf0) !== 0xb0) return null;
  const cc = data[1];
  if (cc === 1 || cc === 64 || cc >= 120) return null;
  const channel = status & 0x0f;
  const value = data[2] / 127;
  const learnt = knobs.find((b) => b.cc === cc && (b.channel == null || b.channel === channel));
  if (learnt) {
    const f = FX.find((x) => x.id === learnt.id);
    return { id: learnt.id, value, slot: fxOnPage(f.page).indexOf(f), page: f.page };
  }
  const slot = cc - FIRST_KNOB_CC;
  if (slot < 0 || slot >= KNOB_COUNT) return null;
  const f = fxOnPage(page)[slot];
  return f ? { id: f.id, value, slot, page } : null;
}

/** Restore saved effect values and learnt controls, dropping anything malformed. */
export function sanitizeFx(savedValues, savedKnobs) {
  const values = { ...DEFAULT_FX };
  if (savedValues && typeof savedValues === 'object') {
    FX.forEach((f) => {
      const v = Number(savedValues[f.id]);
      if (Number.isFinite(v)) values[f.id] = Math.min(Math.max(v, 0), 1);
    });
  }
  const knobs = DEFAULT_KNOBS.map((d) => {
    const s = Array.isArray(savedKnobs) ? savedKnobs.find((k) => k && k.id === d.id) : null;
    if (!s || !Number.isInteger(s.cc) || s.cc < 0 || s.cc > 127) return d;
    const channel = Number.isInteger(s.channel) ? s.channel : null;
    // Before pages, every page-1 effect was saved as explicitly bound to its
    // own knob (CC 21 + slot, any channel); that is now simply the default.
    const f = FX.find((x) => x.id === d.id);
    if (channel == null && f.page === 0 && s.cc === FIRST_KNOB_CC + fxOnPage(0).indexOf(f)) return d;
    return { id: d.id, cc: s.cc, channel };
  });
  return { values, knobs };
}
