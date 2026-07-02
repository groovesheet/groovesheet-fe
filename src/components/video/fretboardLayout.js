/**
 * fretboardLayout — pure music-theory + layout model for the guitar falling-notes
 * visualiser (VideoFretboardRoll). Framework-agnostic; no canvas, no React.
 *
 * The fretboard model (standard tuning, chromatic note names, fret/string layout
 * constants) is ported from sebastian-ederer/fretboard-visualizer (MIT). That
 * repo only carries the music theory + constants; the (string,fret) → x,y
 * coordinate mapping and the MIDI→position assignment below are authored here.
 *
 * A MIDI pitch maps to several (string, fret) spots, so each note must be placed
 * on exactly one. assignFretPositions() does this once when notes load (mirroring
 * how drums precompute a lane), annotating every note with { string, fret }.
 */

// Standard tuning, open-string MIDI numbers low→high: E2 A2 D3 G3 B3 E4.
// Index 0 = low E (MIDI 40), index 5 = high E (MIDI 64).
export const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];
export const NUM_STRINGS = OPEN_STRING_MIDI.length;
export const MAX_FRET = 20;

// Layout constants (from the fretboard-visualizer); used as *ratios* — the
// renderer scales them to the canvas. The open/nut column is narrower than a
// fretted column there (w-8 vs w-14), i.e. 32 vs 56.
export const OPEN_COL_W = 32;
export const FRET_COL_W = 56;
export const FRET_COUNT = MAX_FRET; // columns drawn after the nut

// Inlay (position) markers — single dots, plus a double dot at the octave.
export const SINGLE_INLAYS = [3, 5, 7, 9, 15, 17, 19];
export const DOUBLE_INLAY = 12;

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** MIDI number → note name with octave, e.g. 64 → "E4". */
export function midiToNoteName(midi) {
  const name = CHROMATIC[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

// Chord grouping + continuity tuning.
const CHORD_EPS = 0.03; // onsets within 30ms are treated as one chord
const CONTINUITY_WEIGHT = 0.6; // pull toward the previous hand position
const ORDER_PENALTY = 1.5; // discourage crossing strings out of pitch order

/** Every playable string for a pitch: { string, fret } with fret in [0, MAX_FRET]. */
function candidatesFor(midi) {
  const out = [];
  for (let s = 0; s < NUM_STRINGS; s += 1) {
    const fret = midi - OPEN_STRING_MIDI[s];
    if (fret >= 0 && fret <= MAX_FRET) out.push({ string: s, fret });
  }
  return out;
}

/**
 * Annotate each note with a { string, fret } position. Notes that cannot be
 * played in standard tuning get { string: null, fret: null } (renderer skips
 * them). Mutates and returns the same array, memoised by identity so the roll's
 * effect can call it freely.
 *
 * @param {{time:number,duration:number,midi:number}[]} notes
 */
const _memo = new WeakMap();
export function assignFretPositions(notes) {
  if (!notes || !notes.length) return notes || [];
  if (_memo.has(notes)) return _memo.get(notes);

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
      const cands = candidatesFor(note.midi).filter((c) => !used.has(c.string));
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

  _memo.set(notes, notes);
  return notes;
}
