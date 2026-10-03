/**
 * The light show on /launchpad: what colour every pad is at a moment in time.
 *
 * Each hit starts a wave from its pad, in its drum family's colour, in one of
 * these shapes (EFFECTS). By default each kind of drum has its own
 * (FAMILY_EFFECT: kicks ripple, snares X, hats +, toms diamond, cymbals star,
 * hand drums square, bells rise, shakers twinkle); a pad can have its own, or
 * the whole grid can use one. The shape is fixed when the wave starts.
 *
 * The hit pad itself flashes white, then holds its colour for a moment, so a
 * hit is obvious even mid-roll. Waves add up, so a fast roll or two hands at
 * once blend into each other. Pads rest dark, or (rest: true) on a dim
 * version of their own colour.
 *
 * Colours are Launchpad RGB, 0-63 per channel (what the MK2's "set LED RGB"
 * SysEx takes). Pure maths, no DOM or MIDI, so it can be tested.
 */
import { ROWS, COLS, padNote, padRow, padCol, familyOf } from './layout';

export const EFFECTS = [
  { id: 'ripple', label: 'Ripple', icon: '○' }, // a circle spreading outward
  { id: 'plus', label: 'Plus', icon: '+' }, // beams along the row and column
  { id: 'x', label: 'X', icon: '×' }, // beams along the diagonals
  { id: 'star', label: 'Star', icon: '✳' }, // plus and X together
  { id: 'square', label: 'Square', icon: '□' }, // square rings
  { id: 'diamond', label: 'Diamond', icon: '◇' }, // diamond rings
  { id: 'rise', label: 'Rise', icon: '↑' }, // a beam shooting up the column
  { id: 'twinkle', label: 'Twinkle', icon: '✦' }, // sparkles scattered round the pad
  { id: 'off', label: 'Just the pad', icon: '·' },
];
const EFFECT_IDS = new Set(EFFECTS.map((e) => e.id));
export const isEffect = (id) => EFFECT_IDS.has(id);

export const FAMILY_EFFECT = {
  kick: 'ripple',
  snare: 'x',
  hat: 'plus',
  tom: 'diamond',
  cymbal: 'star',
  hand: 'square',
  bell: 'rise',
  shaker: 'twinkle',
};

/** The grid-wide setting: each drum its own shape ('mixed'), or one for all. */
export const ANIMATIONS = [{ id: 'mixed', label: 'Each drum its own' }, ...EFFECTS.map(({ id, label }) => ({ id, label }))];

/** The shape a hit on a pad makes: one for the whole grid, else the pad's own, else its family's. */
export function effectFor(mode, padEffect, voiceId) {
  if (mode !== 'mixed' && isEffect(mode)) return mode;
  if (isEffect(padEffect)) return padEffect;
  return voiceId ? FAMILY_EFFECT[familyOf(voiceId)] : 'ripple';
}

// Launchpad RGB (0-63) for each drum family, matching the page colours.
export const FAMILY_RGB = {
  kick: [63, 6, 6],
  snare: [63, 26, 0],
  hat: [63, 52, 0],
  tom: [8, 63, 18],
  cymbal: [6, 44, 63],
  hand: [40, 18, 63],
  bell: [14, 24, 63],
  shaker: [63, 12, 38],
};

const REST_LEVEL = 0.13; // how bright a pad sits at rest, when resting pads are lit
const SPEED = 11; // pads per second the wave front travels
const WIDTH = 0.9; // thickness of the ring, in pads
const RING_GAIN = 1.35; // the ring a touch brighter than its colour, clipped at full
const LIFE = 1.0; // seconds a wave lasts
const CORE_HOLD = 0.12; // seconds the hit pad stays fully lit
const CORE_DECAY = 0.25; // then how fast it fades
const FLASH_DECAY = 0.07; // the white flash on the hit pad
const TWINKLE_REACH = 3; // pads around the hit that may sparkle
const TWINKLE_SPREAD = 0.45; // seconds over which the sparkles appear
const TWINKLE_DECAY = 0.11;

// A repeatable 0..1 number per wave and pad, so a twinkle doesn't flicker anew each frame.
function hash(seed, row, col) {
  let h = (Math.floor(seed * 1000) * 374761393 + row * 668265263 + col * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export const rgbFor = (voiceId) => (voiceId ? FAMILY_RGB[familyOf(voiceId)] : [0, 0, 0]);

/** A new wave from `note` at clock time `t0`; `amp` 1 for a hit, less for a loop replay. */
export const makeWave = (note, voiceId, t0, amp = 1, shape = 'ripple') => ({
  row: padRow(note), col: padCol(note), t0, amp, rgb: rgbFor(voiceId), shape,
});

/** Waves still worth drawing at `now` (future ones, scheduled by the loop, are kept). */
export const liveWaves = (waves, now) => waves.filter((w) => now - w.t0 < LIFE);

// How strongly wave `w` lights the pad at (row, col) at time t (0..1).
// How far the pad is from the hit along the shape's path, or null if the shape never reaches it.
function pathDistance(shape, dr, dc) {
  const ar = Math.abs(dr);
  const ac = Math.abs(dc);
  switch (shape) {
    case 'plus': return dr === 0 || dc === 0 ? ar + ac : null;
    case 'x': return ar === ac ? ar : null;
    case 'star': return dr === 0 || dc === 0 ? ar + ac : ar === ac ? ar : null;
    case 'square': return Math.max(ar, ac);
    case 'diamond': return ar + ac;
    case 'rise': return dc === 0 && dr > 0 ? dr : null;
    case 'off': return null;
    default: return Math.hypot(dr, dc); // ripple
  }
}

function strength(w, row, col, t) {
  const dr = row - w.row;
  const dc = col - w.col;
  if (dr === 0 && dc === 0) return t < CORE_HOLD ? 1 : Math.exp(-(t - CORE_HOLD) / CORE_DECAY);
  if (w.shape === 'twinkle') {
    if (Math.max(Math.abs(dr), Math.abs(dc)) > TWINKLE_REACH || hash(w.t0, row, col) > 0.5) return 0;
    const at = hash(w.t0 + 0.5, row, col) * TWINKLE_SPREAD;
    return t < at ? 0 : Math.exp(-(t - at) / TWINKLE_DECAY);
  }
  const d = pathDistance(w.shape, dr, dc);
  if (d == null) return 0;
  const front = SPEED * t;
  const ring = Math.exp(-((d - front) ** 2) / (2 * WIDTH * WIDTH));
  const fade = (1 - t / LIFE) ** 1.5;
  return Math.min(1, ring * fade * RING_GAIN);
}

/**
 * Every pad's colour at `now`: note -> [r, g, b] (0-63), plus how lit each one
 * is above its resting colour (0..1), for the page's glow.
 */
export function frame(now, waves, grid, { rest = false } = {}) {
  const restLevel = rest ? REST_LEVEL : 0;
  const colors = new Map();
  const glow = new Map();
  for (let row = 1; row <= ROWS; row += 1) {
    for (let col = 1; col <= COLS; col += 1) {
      const note = padNote(row, col);
      const base = rgbFor(grid[note]);
      let r = base[0] * restLevel;
      let g = base[1] * restLevel;
      let b = base[2] * restLevel;
      let lit = 0;
      for (const w of waves) {
        const t = now - w.t0;
        if (t < 0 || t >= LIFE) continue;
        const s = strength(w, row, col, t) * w.amp;
        if (s < 0.01) continue;
        r += w.rgb[0] * s;
        g += w.rgb[1] * s;
        b += w.rgb[2] * s;
        if (row === w.row && col === w.col) {
          const white = 40 * Math.exp(-t / FLASH_DECAY) * w.amp; // the strike itself
          r += white; g += white; b += white;
        }
        lit += s;
      }
      colors.set(note, [r, g, b].map((v) => Math.min(63, Math.round(v))));
      glow.set(note, Math.min(1, lit));
    }
  }
  return { colors, glow };
}

const LP_HEADER = [0xf0, 0x00, 0x20, 0x29, 0x02, 0x18];
const MAX_PER_MESSAGE = 80; // the MK2 takes up to 80 LEDs in one "set LED RGB"

/** MK2 "set LED RGB" SysEx messages for the pads in `changes` (note -> [r, g, b]). */
export function rgbMessages(changes) {
  const entries = [...changes.entries()];
  const out = [];
  for (let i = 0; i < entries.length; i += MAX_PER_MESSAGE) {
    const body = entries.slice(i, i + MAX_PER_MESSAGE).flatMap(([note, [r, g, b]]) => [note, r, g, b]);
    out.push([...LP_HEADER, 0x0b, ...body, 0xf7]);
  }
  return out;
}

/**
 * Without SysEx the pads can only take palette colours: the family's bright
 * colour when lit, its dim one when glowing a little, else the resting colour.
 */
export function paletteFor(level, bright, dim, rest) {
  if (level > 0.45) return bright;
  if (level > 0.12) return dim;
  return rest;
}
