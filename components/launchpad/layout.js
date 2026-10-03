/**
 * The /launchpad drum kit: which drum each pad of a Novation Launchpad plays,
 * and what colour it lights.
 *
 * Launchpad MK2 in its Session layout (Programmer's Reference Guide): the 8x8
 * grid sends note-ons on channel 1 numbered row * 10 + column, rows 1-8 from
 * the bottom, so the bottom-left pad is 11 and the top-right 88. The round
 * buttons down the right side are notes 19, 29 ... 89 (top is 89), and the
 * round buttons along the top are CC 104-111. The pads are not velocity
 * sensitive (a hit is 127). Sending the same note or CC back lights the button
 * in that colour from the Launchpad's 128-colour palette (velocity 0 is off).
 *
 * The default kit puts what a drummer plays most under the left hand and the
 * bottom rows (kick and snare doubled for two-finger rolls, hats beside them),
 * toms along row 4, cymbals and the rest of the kit on the right, and every
 * other drum of the 49 above, so each one is a pad away. Any pad can be
 * changed on the page.
 */
import { DRUM_VOICES } from '../midikeys/drumKit';

export const ROWS = 8;
export const COLS = 8;

export const padNote = (row, col) => row * 10 + col; // row 1 = bottom, col 1 = left
export const padRow = (note) => Math.floor(note / 10);
export const padCol = (note) => note % 10;
export const isGridNote = (note) => padRow(note) >= 1 && padRow(note) <= ROWS && padCol(note) >= 1 && padCol(note) <= COLS;

/** Every grid pad, top row first (the order they are drawn on the page). */
export const GRID_NOTES = Array.from({ length: ROWS }, (_, i) => ROWS - i)
  .flatMap((row) => Array.from({ length: COLS }, (_, j) => padNote(row, j + 1)));

// The round buttons on the right, as notes, top to bottom.
export const SIDE = { loop: 89, stop: 79, undo: 69 };
export const SIDE_NOTES = [89, 79, 69, 59, 49, 39, 29, 19];
export const TOP_CCS = [104, 105, 106, 107, 108, 109, 110, 111];

// Bottom row first, each row left to right.
const DEFAULT_ROWS = [
  ['kick', 'kick', 'snare', 'snare', 'tom5', 'tom6', 'ride', 'rideBell'],
  ['hatClosed', 'hatClosed', 'rim', 'clap', 'crash', 'crash2', 'splash', 'china'],
  ['hatPedal', 'hatOpen', 'snare2', 'kick808', 'ride2', 'tambourine', 'cowbell', 'shaker'],
  ['tom1', 'tom2', 'tom3', 'tom4', 'clave', 'cabasa', 'eggShaker', 'jingle'],
  ['bongoHigh', 'bongoLow', 'congaMute', 'congaOpen', 'congaLow', 'timbaleHigh', 'timbaleLow', 'vibraslap'],
  ['agogoHigh', 'agogoLow', 'blockHigh', 'blockLow', 'cuicaMute', 'cuicaOpen', 'triangleMute', 'triangleOpen'],
  ['whistleShort', 'whistleLong', 'guiroShort', 'guiroLong', 'kick', 'snare', 'hatClosed', 'hatOpen'],
  ['crash', 'ride', 'tom1', 'tom6', 'clap', 'rim', 'hatPedal', 'crash2'],
];

/** Pad note -> voice id. */
export const DEFAULT_GRID = Object.fromEntries(
  DEFAULT_ROWS.flatMap((ids, r) => ids.map((id, c) => [padNote(r + 1, c + 1), id]))
);

// ---- colours ----------------------------------------------------------------

// `lp` is the Launchpad palette index, lit and dim; `css` the page's colour.
export const FAMILIES = {
  kick: { label: 'Kicks', lp: [5, 7], css: '#ff4d4d' },
  snare: { label: 'Snares and claps', lp: [9, 11], css: '#ff9a2e' },
  hat: { label: 'Hi-hats', lp: [13, 15], css: '#ffd83b' },
  tom: { label: 'Toms', lp: [21, 23], css: '#3ddc84' },
  cymbal: { label: 'Cymbals', lp: [37, 39], css: '#38bdf8' },
  hand: { label: 'Hand drums', lp: [49, 51], css: '#a78bfa' },
  bell: { label: 'Bells and blocks', lp: [45, 47], css: '#6b8cff' },
  shaker: { label: 'Shakers and effects', lp: [53, 55], css: '#f472b6' },
};

const FAMILY_OF = {
  kick: 'kick', kick808: 'kick',
  snare: 'snare', snare2: 'snare', rim: 'snare', clap: 'snare',
  hatClosed: 'hat', hatPedal: 'hat', hatOpen: 'hat',
  tom1: 'tom', tom2: 'tom', tom3: 'tom', tom4: 'tom', tom5: 'tom', tom6: 'tom',
  crash: 'cymbal', crash2: 'cymbal', ride: 'cymbal', ride2: 'cymbal', rideBell: 'cymbal', splash: 'cymbal', china: 'cymbal',
  bongoHigh: 'hand', bongoLow: 'hand', congaMute: 'hand', congaOpen: 'hand', congaLow: 'hand', timbaleHigh: 'hand', timbaleLow: 'hand',
  cowbell: 'bell', agogoHigh: 'bell', agogoLow: 'bell', clave: 'bell', blockHigh: 'bell', blockLow: 'bell',
  triangleMute: 'bell', triangleOpen: 'bell', jingle: 'bell',
};

/** A voice's colour family; anything not listed is a shaker or effect. */
export const familyOf = (voiceId) => FAMILY_OF[voiceId] || 'shaker';

export const LP_OFF = 0;
export const LP_WHITE = 3;
export const LP_RED = 5;
export const LP_GREEN = 21;
export const LP_AMBER = 9;
export const LP_DIM_WHITE = 1;
export const LP_DIM_RED = 7;
export const LP_DIM_BLUE = 47;

/** The palette colour a pad rests on: its family's, dim. */
export const restColor = (voiceId) => (voiceId ? FAMILIES[familyOf(voiceId)].lp[1] : LP_OFF);
/** The colour it flashes when hit: its family's, bright. */
export const hitColor = (voiceId) => (voiceId ? FAMILIES[familyOf(voiceId)].lp[0] : LP_OFF);

/** The loop button's colour for a looper state. */
export function loopColor(state) {
  if (state === 'armed') return LP_AMBER;
  if (state === 'recording') return LP_RED;
  if (state === 'overdub') return LP_AMBER;
  if (state === 'playing') return LP_GREEN;
  if (state === 'stopped') return LP_DIM_WHITE;
  return LP_DIM_WHITE;
}

/** Restore a saved grid, keeping only pads and voices that exist. */
export function sanitizeGrid(saved) {
  const known = new Set(DRUM_VOICES.map((v) => v.id));
  const grid = { ...DEFAULT_GRID };
  if (saved && typeof saved === 'object') {
    Object.entries(saved).forEach(([note, id]) => {
      if (isGridNote(Number(note)) && known.has(id)) grid[note] = id;
    });
  }
  return grid;
}

// ---- SysEx ------------------------------------------------------------------

const LP_HEADER = [0xf0, 0x00, 0x20, 0x29, 0x02, 0x18];
/** Launchpad MK2: switch to the Session layout, so the grid sends 11-88. */
export const SESSION_LAYOUT = [...LP_HEADER, 0x22, 0x00, 0xf7];
