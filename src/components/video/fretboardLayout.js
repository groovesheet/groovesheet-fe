/**
 * fretboardLayout — pure music-theory + layout model for the fretted-instrument
 * falling-notes visualiser (VideoFretboardRoll). Framework-agnostic; no canvas,
 * no React.
 *
 * The fretboard model (chromatic note names, fret/string layout constants) is
 * ported from sebastian-ederer/fretboard-visualizer (MIT). That repo only
 * carries the music theory + constants; the (string,fret) → x,y coordinate
 * mapping and the MIDI→position assignment below are authored here.
 *
 * A MIDI pitch maps to several (string, fret) spots, so each note must be placed
 * on exactly one. assignFretPositions() does this once when notes load (mirroring
 * how drums precompute a lane), annotating every note with { string, fret }.
 *
 * The board is parameterised per instrument via getFretboard(kind): a 6-string
 * guitar in standard tuning and a 4-string bass in standard tuning share all the
 * geometry and placement logic, differing only in their open-string tuning,
 * string count, colours and string gauge.
 */

// ── Per-instrument fretboards ────────────────────────────────────────────────
// Open-string MIDI numbers, low→high (index 0 = lowest/thickest string).
//   Guitar standard:  E2 A2 D3 G3 B3 E4  → 40 45 50 55 59 64
//   Bass 4-string std: E1 A1 D2 G2       → 28 33 38 43
const FRETBOARDS = {
  guitar: {
    kind: 'guitar',
    openStringMidi: [40, 45, 50, 55, 59, 64],
    // Draw/assign the first 17 frets only. Fewer columns than a full 20-fret neck
    // means each column is wider, so falling circles read bigger and further
    // apart. The 17th fret on the high E is A5 — above almost anything in these
    // guitar parts, so nothing meaningful is dropped.
    maxFret: 17,
    // per-string colour, low→high. Warm-to-cool so strings read apart.
    stringColors: ['#E8590C', '#F08C00', '#F5C518', '#2F9E44', '#1098AD', '#4263EB'],
    // string-gauge coefficient: line width = 1 + (topIndex - s) * gauge.
    gauge: 0.5,
    // wood tint for the board gradient (top → bottom). Maple-ish.
    board: ['#2a1c12', '#1a110a'],
  },
  bass: {
    kind: 'bass',
    openStringMidi: [28, 33, 38, 43],
    maxFret: 20,
    // 4 strings picked to span the same warm→cool arc as guitar.
    stringColors: ['#E8590C', '#F5C518', '#2F9E44', '#4263EB'],
    // bass strings are physically much thicker — steeper gauge, drawn heavier.
    gauge: 0.9,
    // darker rosewood tint so bass reads distinct from the guitar board.
    board: ['#241610', '#150c07'],
  },
};

/** Resolve the fretboard config for an instrument kind (defaults to guitar). */
export function getFretboard(kind) {
  const fb = FRETBOARDS[kind] || FRETBOARDS.guitar;
  return { ...fb, numStrings: fb.openStringMidi.length, fretCount: fb.maxFret };
}

// Backward-compatible guitar constants (existing importers rely on these).
const GUITAR = getFretboard('guitar');
export const OPEN_STRING_MIDI = GUITAR.openStringMidi;
export const NUM_STRINGS = GUITAR.numStrings;
export const MAX_FRET = GUITAR.maxFret;

// Layout constants (from the fretboard-visualizer); used as *ratios* — the
// renderer scales them to the canvas. The open/nut column is narrower than a
// fretted column there (w-8 vs w-14), i.e. 32 vs 56. Shared across instruments.
export const OPEN_COL_W = 32;
export const FRET_COL_W = 56;
export const FRET_COUNT = MAX_FRET; // columns drawn after the nut (guitar default)

// Inlay (position) markers — single dots, plus a double dot at the octave.
// Shared: both guitar and 4-string bass carry the same dot pattern.
export const SINGLE_INLAYS = [3, 5, 7, 9, 15, 17, 19];
export const DOUBLE_INLAY = 12;

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** MIDI number → note name with octave, e.g. 64 → "E4". */
export function midiToNoteName(midi) {
  const name = CHROMATIC[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

/** MIDI number → pitch-class letter without octave, e.g. 64 → "E". */
export function midiToPitchClass(midi) {
  return CHROMATIC[((midi % 12) + 12) % 12];
}

// Chord grouping + continuity tuning.
const CHORD_EPS = 0.03; // onsets within 30ms are treated as one chord
const CONTINUITY_WEIGHT = 0.6; // pull toward the previous hand position
const ORDER_PENALTY = 1.5; // discourage crossing strings out of pitch order

/** Every playable string for a pitch: { string, fret } with fret in [0, maxFret]. */
function candidatesFor(midi, fb) {
  const out = [];
  for (let s = 0; s < fb.numStrings; s += 1) {
    const fret = midi - fb.openStringMidi[s];
    if (fret >= 0 && fret <= fb.maxFret) out.push({ string: s, fret });
  }
  return out;
}

/**
 * Annotate each note with a { string, fret } position for the given fretboard.
 * Notes that cannot be played in that tuning get { string: null, fret: null }
 * (renderer skips them). Mutates and returns the same array, memoised by identity
 * so the roll's effect can call it freely.
 *
 * @param {{time:number,duration:number,midi:number}[]} notes
 * @param {object} [fretboard]  result of getFretboard(kind); defaults to guitar
 */
const _memo = new WeakMap();
export function assignFretPositions(notes, fretboard) {
  if (!notes || !notes.length) return notes || [];
  const fb = fretboard || GUITAR;
  // Memo keyed by the notes array; guard on kind so re-tuning invalidates it.
  const cached = _memo.get(notes);
  if (cached && cached.kind === fb.kind) return notes;

  // Work on a time-sorted copy of references so chord grouping is correct, but
  // annotate the original note objects.
  const sorted = notes.slice().sort((a, b) => a.time - b.time);

  let prevHandPos = 5; // start mid-neck so the first low notes don't all hug fret 0
  let i = 0;
  while (i < sorted.length) {
    // collect a chord: all notes whose onset is within CHORD_EPS of the first.
    const chord = [sorted[i]];
    const t0 = sorted[i].time;
    let j = i + 1;
    while (j < sorted.length && sorted[j].time - t0 <= CHORD_EPS) {
      chord.push(sorted[j]);
      j += 1;
    }

    // assign low pitch → low string first so voicings stack naturally.
    chord.sort((a, b) => a.midi - b.midi);
    const used = new Set();
    const placed = [];
    for (let k = 0; k < chord.length; k += 1) {
      const note = chord[k];
      const cands = candidatesFor(note.midi, fb).filter((c) => !used.has(c.string));
      if (!cands.length) {
        note.string = null;
        note.fret = null;
        continue;
      }
      let best = null;
      let bestCost = Infinity;
      for (const c of cands) {
        // prefer low frets, stay near the previous hand position, and keep the
        // string order matching the pitch order within this chord.
        let cost = c.fret + CONTINUITY_WEIGHT * Math.abs(c.fret - prevHandPos);
        const expectedMinString = placed.length ? placed[placed.length - 1].string + 1 : 0;
        if (c.string < expectedMinString) cost += ORDER_PENALTY * (expectedMinString - c.string);
        if (cost < bestCost) { bestCost = cost; best = c; }
      }
      note.string = best.string;
      note.fret = best.fret;
      used.add(best.string);
      placed.push(best);
    }

    if (placed.length) {
      prevHandPos = placed.reduce((sum, p) => sum + p.fret, 0) / placed.length;
    }
    i = j;
  }

  _memo.set(notes, { kind: fb.kind });
  return notes;
}
