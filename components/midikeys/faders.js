/**
 * The mixer on /midi-keyboard, played from the Launchkey 49/61's nine faders.
 *
 * Measured on Edward's Launchkey MK4 49 in Standalone mode (2026-10-02, a
 * MIDI log while sweeping each fader): the nine faders send Control Changes
 * 71-79, left to right. They came on channel 15 that day and on channel 16 on
 * 2026-10-04 (the keyboard's MIDI channel had changed), so, like the knobs,
 * the defaults answer on any channel. (The Programmer's Reference Guide's
 * CC 5-13 on channel 16 is the DAW fader mode, which this page does not use.)
 * Each fader can still be re-learnt, to one channel.
 *
 *   1 Keys     what you play live      6 Layer 4
 *   2 Drums    the pads, live          7 Layer 5 and up
 *   3 Take 1   the loop's first take   8 Loop (all of it)
 *   4 Layer 2  each overdub pass ...   9 Master, the Launchkey's master fader
 *   5 Layer 3
 *
 * Positions are 0..1; gain follows a squared taper (like a real fader, most
 * of the travel is the useful top 20 dB), with unity at about 90%.
 */

export const FADERS = [
  { id: 'keys', label: 'Keys', def: 0.9 },
  { id: 'drums', label: 'Drums', def: 0.63 },
  { id: 'layer0', label: 'Take 1', def: 0.9, layer: 0 },
  { id: 'layer1', label: 'Layer 2', def: 0.9, layer: 1 },
  { id: 'layer2', label: 'Layer 3', def: 0.9, layer: 2 },
  { id: 'layer3', label: 'Layer 4', def: 0.9, layer: 3 },
  { id: 'layer4', label: 'Layer 5+', def: 0.9, layer: 4 },
  { id: 'loop', label: 'Loop', def: 0.9 },
  { id: 'master', label: 'Master', def: 0.85 },
];

export const FIRST_FADER_CC = 71;
const MEASURED_CHANNEL = 14; // channel 15, what the first defaults were tied to
// What the defaults were before they were measured: CC 5-13 on channel 16.
const OLD_FIRST_FADER_CC = 5;
const OLD_FADER_CHANNEL = 15;

export const faderGain = (pos) => 1.25 * pos * pos;
export const gainToFader = (gain) => Math.min(1, Math.sqrt(Math.max(gain, 0) / 1.25));

/** The fader a loop layer plays through: layers 5 and up share the last one. */
export const faderForLayer = (layer) => `layer${Math.min(Math.max(layer || 0, 0), 4)}`;

export function faderLabel(pos) {
  const g = faderGain(pos);
  if (g < 0.001) return '-inf';
  const db = 20 * Math.log10(g);
  return `${db > 0.05 ? '+' : ''}${db.toFixed(1)} dB`;
}

export const DEFAULT_FADERS = Object.fromEntries(FADERS.map((f) => [f.id, f.def]));
// channel null = any channel
export const DEFAULT_FADER_BINDINGS = FADERS.map((f, i) => ({ id: f.id, cc: FIRST_FADER_CC + i, channel: null }));

/** Which fader a Control Change moves, or null. */
export function faderForMessage(bindings, data) {
  const status = data[0];
  if ((status & 0xf0) !== 0xb0) return null;
  const cc = data[1];
  const channel = status & 0x0f;
  const i = bindings.findIndex((b) => b.cc === cc && (b.channel == null || b.channel === channel));
  if (i < 0) return null;
  return { id: bindings[i].id, value: data[2] / 127, slot: FADERS.findIndex((f) => f.id === bindings[i].id) };
}

/**
 * Restore saved fader positions and bindings. Before the faders, levels were
 * saved as gains under `volumes` (master / piano / drums / loop); those carry
 * over to the matching faders.
 */
export function sanitizeFaders(saved, savedBindings, oldVolumes) {
  const values = { ...DEFAULT_FADERS };
  if (oldVolumes && typeof oldVolumes === 'object') {
    const map = { master: 'master', piano: 'keys', drums: 'drums', loop: 'loop' };
    Object.entries(map).forEach(([from, to]) => {
      const g = Number(oldVolumes[from]);
      if (Number.isFinite(g)) values[to] = gainToFader(g);
    });
  }
  if (saved && typeof saved === 'object') {
    FADERS.forEach((f) => {
      const v = Number(saved[f.id]);
      if (Number.isFinite(v)) values[f.id] = Math.min(Math.max(v, 0), 1);
    });
  }
  const bindings = DEFAULT_FADER_BINDINGS.map((d, i) => {
    const s = Array.isArray(savedBindings) ? savedBindings.find((b) => b && b.id === d.id) : null;
    if (!s) return d;
    // a binding saved under the old guessed defaults is just the default
    if (s.cc === OLD_FIRST_FADER_CC + i && s.channel === OLD_FADER_CHANNEL) return d;
    // and so is one saved when the defaults were tied to channel 15
    if (s.cc === FIRST_FADER_CC + i && s.channel === MEASURED_CHANNEL) return d;
    if (s.cc === null) return { id: d.id, cc: null, channel: null };
    if (!Number.isInteger(s.cc) || s.cc < 0 || s.cc > 127) return d;
    return { id: d.id, cc: s.cc, channel: Number.isInteger(s.channel) ? s.channel : null };
  });
  return { values, bindings };
}
