/**
 * The keys' effects on /midi-keyboard, laid out like a stage piano's panel
 * (the Nord Stage: Amp/EQ, Effect 1, Effect 2, Delay, Reverb) and played from
 * the Launchkey's eight knobs, left to right.
 *
 * The knobs send Control Changes 21-28 (Programmer's Reference Guide, encoder
 * indices 15h-1Ch, absolute 0-127). Which channel they arrive on depends on
 * the Launchkey's knob mode, so a default binding matches any channel; any
 * knob can be re-learnt from another control.
 *
 * Every value here is 0..1. EQ knobs sit at 0.5 for flat, like a centred pot.
 */

export const FX = [
  { id: 'drive', label: 'Drive', group: 'Amp', def: 0, fmt: (v) => `${Math.round(v * 100)}%` },
  { id: 'treble', label: 'Treble', group: 'EQ', def: 0.5, fmt: (v) => db((v - 0.5) * 24) },
  { id: 'bass', label: 'Bass', group: 'EQ', def: 0.5, fmt: (v) => db((v - 0.5) * 24) },
  { id: 'tremolo', label: 'Tremolo', group: 'Effect 1', def: 0, fmt: (v) => `${Math.round(v * 100)}%` },
  { id: 'phaser', label: 'Phaser', group: 'Effect 2', def: 0, fmt: (v) => `${Math.round(v * 100)}%` },
  { id: 'delay', label: 'Amount', group: 'Delay', def: 0, fmt: (v) => `${Math.round(v * 100)}%` },
  { id: 'delayTime', label: 'Time', group: 'Delay', def: 0.4, fmt: (v) => `${Math.round(delaySeconds(v) * 1000)} ms` },
  { id: 'reverb', label: 'Amount', group: 'Reverb', def: 0.15, fmt: (v) => `${Math.round(v * 100)}%` },
];

function db(x) {
  const r = Math.round(x * 10) / 10;
  if (Math.abs(r) < 0.05) return '0 dB';
  return `${r > 0 ? '+' : ''}${r.toFixed(1)} dB`;
}

export const delaySeconds = (v) => 0.06 + v * 0.94;

export const DEFAULT_FX = Object.fromEntries(FX.map((f) => [f.id, f.def]));

// Knob n (left to right) = CC 21 + n, on any channel.
export const DEFAULT_KNOBS = FX.map((f, i) => ({ id: f.id, cc: 21 + i, channel: null }));

/**
 * Which effect a Control Change turns, or null. CC 1 (mod wheel), 64
 * (sustain) and the channel-mode messages (120+) are never knobs.
 */
export function knobForMessage(knobs, data) {
  const status = data[0];
  if ((status & 0xf0) !== 0xb0) return null;
  const cc = data[1];
  if (cc === 1 || cc === 64 || cc >= 120) return null;
  const channel = status & 0x0f;
  const k = knobs.find((b) => b.cc === cc && (b.channel == null || b.channel === channel));
  return k ? { id: k.id, value: data[2] / 127 } : null;
}

/** Restore saved effect values and knob bindings, dropping anything malformed. */
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
    if (s && s.cc === null) return { id: d.id, cc: null, channel: null }; // given to another effect
    if (!s || !Number.isInteger(s.cc) || s.cc < 0 || s.cc > 127) return d;
    return { id: d.id, cc: s.cc, channel: Number.isInteger(s.channel) ? s.channel : null };
  });
  return { values, knobs };
}
