/**
 * Falling-note roll for /bistable, driven by the shared transport clock.
 *
 * Two jobs, both pure — no React, no canvas ownership, no time of its own:
 *
 *   - `heldAt(t)` answers "which notes are sounding at t?". The draw loop
 *     diffs that against the previous frame and feeds the difference into the
 *     SAME noteOn/noteOff the MIDI controller uses, so a landing note lights
 *     the key and fires the ink exactly as a human press does.
 *   - `draw(...)` paints the notes descending onto the hit line.
 *
 * Asking "what is held NOW" each frame, rather than replaying events past a
 * moving cursor, is what makes scrubbing safe: the answer depends only on `t`,
 * so seeking backwards, jumping, or dropping frames all resolve correctly
 * without a fire-index that can desynchronise from the audio.
 *
 * Notes are laid out on the REAL key rectangles (`byMidi`), not a uniform
 * pitch scale, so a note lands exactly on the key it belongs to even after the
 * key-width / black-key-ratio sliders have reshaped the keyboard to match a
 * physical piano under the projection.
 */

// Seconds of lookahead visible above the keys. Smaller = taller, faster notes.
const VISIBLE_WINDOW = 3;

// A transcription can emit a zero-length note; without a floor it would be
// held for no frames at all and never light its key.
const MIN_SOUND_SEC = 0.05;

const WHITE_NOTE = '#012FA7'; // GrooveSheet brand blue, matching the lit key
const BLACK_NOTE = '#3f74e8'; // brightened, as the black keys' lit colour is

/** First index whose `time` is strictly greater than `t` (binary search). */
function upperBound(notes, t) {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid].time <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Normalise a note list (from @tonejs/midi or anywhere else) into the shape
 * the scheduler and renderer use, sorted by start time.
 *
 * @tonejs/midi reports velocity as 0..1; the keyboard and effects speak the
 * MIDI 1..127 the controller sends, so it is converted once here.
 */
export function normaliseNotes(rawNotes) {
  return (rawNotes || [])
    .filter((n) => n && Number.isFinite(n.time) && Number.isFinite(n.midi))
    .map((n) => ({
      time: Math.max(0, n.time),
      duration: Math.max(MIN_SOUND_SEC, Number(n.duration) || 0),
      midi: Math.round(n.midi),
      // already-0..127 velocities pass through; 0..1 floats are scaled up
      velocity: n.velocity > 1
        ? Math.round(n.velocity)
        : Math.max(1, Math.round((n.velocity == null ? 0.8 : n.velocity) * 127)),
    }))
    .sort((a, b) => a.time - b.time);
}

/**
 * Build a scheduler over a note list.
 *
 * `maxDuration` bounds how far back a note can have started and still be
 * sounding, which is what lets `heldAt` scan a short window instead of the
 * whole piece every frame.
 */
export function createNoteScheduler(rawNotes) {
  const notes = normaliseNotes(rawNotes);
  const maxDuration = notes.reduce((m, n) => Math.max(m, n.duration), 0);
  const duration = notes.reduce((m, n) => Math.max(m, n.time + n.duration), 0);

  /** Notes sounding at `t`, as midi -> velocity. */
  const heldAt = (t) => {
    const out = new Map();
    if (!notes.length || !Number.isFinite(t)) return out;
    // Walk back from the last note that has started, far enough that even the
    // longest note still sounding is reached.
    const end = upperBound(notes, t);
    const floor = t - maxDuration;
    for (let i = end - 1; i >= 0; i -= 1) {
      const n = notes[i];
      if (n.time < floor) break;
      if (t < n.time + n.duration) {
        // A repeated pitch keeps the newest velocity — same as a re-press.
        if (!out.has(n.midi)) out.set(n.midi, n.velocity);
      }
    }
    return out;
  };

  /** Index range [start, end) covering everything visible at `t`. */
  const visibleRange = (t, windowSec = VISIBLE_WINDOW) => {
    const end = upperBound(notes, t + windowSec);
    let start = end;
    const floor = t - maxDuration;
    while (start > 0 && notes[start - 1].time >= floor) start -= 1;
    return { start, end };
  };

  return { notes, heldAt, visibleRange, duration, maxDuration };
}

/**
 * Paint the falling notes above the hit line.
 *
 * Expects the caller's 2D context in backing-store pixels and the layout the
 * keyboard itself was drawn from, so notes and keys cannot drift apart.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} scheduler  from createNoteScheduler
 * @param {number} t          transport position, seconds
 * @param {object} layout     { keyTop, byMidi } — the live keyboard geometry
 * @param {object} [opts]     { windowSec, width }
 */
export function drawFallingNotes(ctx, scheduler, t, layout, opts = {}) {
  if (!scheduler || !layout || !Number.isFinite(t)) return;
  const { keyTop, byMidi } = layout;
  if (!keyTop || !byMidi) return;

  const windowSec = opts.windowSec || VISIBLE_WINDOW;
  const width = opts.width || ctx.canvas.width;
  const fallHeight = keyTop;
  if (fallHeight <= 0) return;

  const { notes } = scheduler;
  const { start, end } = scheduler.visibleRange(t, windowSec);
  if (start >= end) return;

  const scale = width / 1920; // glow tuned at 1920 wide, as the keys' is
  const radius = Math.max(1, 4 * scale);

  // Whites and blacks are batched into two paths so the fill + glow state is
  // set twice per frame instead of once per note.
  const whitePath = new Path2D();
  const blackPath = new Path2D();
  let anyWhite = false;
  let anyBlack = false;

  for (let i = start; i < end; i += 1) {
    const n = notes[i];
    const k = byMidi.get(n.midi);
    if (!k) continue; // outside the drawn 88 keys

    // Time maps to distance above the hit line: a note reaches it at n.time.
    const bottom = fallHeight - ((n.time - t) / windowSec) * fallHeight;
    const top = fallHeight - ((n.time + n.duration - t) / windowSec) * fallHeight;
    const yTop = Math.max(0, top);
    const yBottom = Math.min(fallHeight, bottom);
    if (yBottom - yTop <= 0) continue; // fully past or not yet on screen

    const isBlack = k.w < (layout.whiteWidth || k.w) * 0.95;
    const path = isBlack ? blackPath : whitePath;
    if (isBlack) anyBlack = true; else anyWhite = true;
    // Inset by 1px so adjacent notes read as separate blocks.
    path.roundRect(k.x + 1, yTop, Math.max(1, k.w - 2), yBottom - yTop, radius);
  }

  ctx.save();
  if (anyWhite) {
    ctx.fillStyle = WHITE_NOTE;
    ctx.shadowColor = WHITE_NOTE;
    ctx.shadowBlur = 18 * scale;
    ctx.fill(whitePath);
  }
  if (anyBlack) {
    ctx.fillStyle = BLACK_NOTE;
    ctx.shadowColor = BLACK_NOTE;
    ctx.shadowBlur = 18 * scale;
    ctx.fill(blackPath);
  }
  ctx.restore();
}

export { VISIBLE_WINDOW, MIN_SOUND_SEC };
