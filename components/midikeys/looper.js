/**
 * The /midi-keyboard looper: a MIDI loop recorder with one button.
 *
 * Pure state and timing, no audio and no React: the page feeds it the clock
 * (seconds, any monotonic source) and the notes it hears, and asks it each
 * tick which loop events fall due inside the next lookahead window.
 *
 * The one-button cycle, the way a loop pedal works:
 *
 *   empty  --press-->  armed       waiting; nothing is recorded yet
 *   armed  --note--->  recording   the loop starts AT the first note, not at
 *                                  the press, because you cannot hit the loop
 *                                  button and the first key at the same instant
 *   recording --press--> playing   the press closes the loop: its length runs
 *                                  from the first note to this press, and
 *                                  playback starts again from the first note
 *   playing --press-->  overdub    layer more notes over the running loop
 *   overdub --press-->  playing
 *   stopped --press-->  playing    from the top
 *
 * Stop: playing / overdub / recording -> stopped (a loop being recorded is
 * closed first, so nothing played is lost); armed -> empty; stopped -> empty
 * (a second Stop clears, as on most loop pedals).
 */

// A press this soon after the first note is a mis-hit, not a loop.
export const MIN_LOOP_SEC = 0.25;
// Floor for a note's length, so a staccato tap still sounds when replayed.
const MIN_NOTE_SEC = 0.05;

const byTime = (a, b) => a.t - b.t;

export function createLooper() {
  let state = 'empty';
  let events = []; // { type: 'piano', midi, vel, t, dur, layer } | { type: 'drum', note, voice, vel, t, layer }
  let length = 0; // seconds, set when the loop is closed
  let recStart = 0; // clock time of the first recorded note
  let playStart = 0; // clock time the current playback began (offset 0)
  let scheduledUntil = 0; // everything before this has been handed out
  let layer = 0; // 0 = the base take, 1.. = overdub passes
  const open = new Map(); // midi -> { ev, abs }: piano notes still held

  const offsetAt = (now) => {
    if (!length) return 0;
    const o = (now - playStart) % length;
    return o < 0 ? o + length : o;
  };

  // Close held notes at `now`. While recording the loop ends at `now`, so a
  // note still down runs to the end of the loop; in an overdub it gets its
  // real length, capped at one loop.
  const closeOpen = (now) => {
    open.forEach(({ ev, abs }) => {
      ev.dur = Math.max(MIN_NOTE_SEC, Math.min(now - abs, length || Infinity));
    });
    open.clear();
  };

  const startPlaying = (now) => {
    state = 'playing';
    playStart = now;
    scheduledUntil = now;
  };

  const closeLoop = (now) => {
    const len = now - recStart;
    if (len < MIN_LOOP_SEC) {
      reset();
      return false;
    }
    length = len;
    closeOpen(now);
    events.sort(byTime);
    return true;
  };

  function reset() {
    state = 'empty';
    events = [];
    length = 0;
    layer = 0;
    open.clear();
  }

  /** The loop button. */
  function press(now) {
    switch (state) {
      case 'empty':
        state = 'armed';
        break;
      case 'armed':
        state = 'empty';
        break;
      case 'recording':
        if (closeLoop(now)) startPlaying(now);
        break;
      case 'playing':
        state = 'overdub';
        layer += 1;
        break;
      case 'overdub':
        closeOpen(now);
        state = 'playing';
        break;
      case 'stopped':
        startPlaying(now);
        break;
      default:
        break;
    }
    return state;
  }

  /** The stop button: stop, and a second stop clears. */
  function stop(now) {
    switch (state) {
      case 'armed':
      case 'stopped':
        reset();
        break;
      case 'recording':
        if (closeLoop(now)) state = 'stopped';
        break;
      case 'playing':
      case 'overdub':
        closeOpen(now);
        state = 'stopped';
        break;
      default:
        break;
    }
    return state;
  }

  /** Where a note heard at `now` lands in the loop, or null if not recording. */
  const recordOffset = (now) => {
    if (state === 'armed') {
      state = 'recording';
      recStart = now;
      return 0;
    }
    if (state === 'recording') return now - recStart;
    if (state === 'overdub') return offsetAt(now);
    return null;
  };

  function pianoOn(midi, vel, now) {
    const t = recordOffset(now);
    if (t == null) return;
    // A re-press of a key still held closes the earlier note first.
    const prev = open.get(midi);
    if (prev) prev.ev.dur = Math.max(MIN_NOTE_SEC, now - prev.abs);
    const ev = { type: 'piano', midi, vel, t, dur: MIN_NOTE_SEC, layer };
    events.push(ev);
    open.set(midi, { ev, abs: now });
  }

  function pianoOff(midi, now) {
    const held = open.get(midi);
    if (!held) return;
    open.delete(midi);
    held.ev.dur = Math.max(MIN_NOTE_SEC, Math.min(now - held.abs, length || Infinity));
  }

  function drum(note, voice, vel, now) {
    const t = recordOffset(now);
    if (t == null) return;
    events.push({ type: 'drum', note, voice, vel, t, layer });
  }

  /**
   * Hand out every loop event due in [scheduledUntil, now + lookahead), each
   * with the clock time it should sound at. Call it every few tens of ms.
   * Events overdubbed in the current pass were already heard live, and they
   * land behind scheduledUntil, so they first replay on the next pass.
   */
  function schedule(now, lookahead, emit) {
    if ((state !== 'playing' && state !== 'overdub') || !length) return;
    if (state === 'overdub') events.sort(byTime);
    const from = Math.max(scheduledUntil, playStart);
    const to = now + lookahead;
    if (to <= from) return;
    const firstPass = Math.floor((from - playStart) / length);
    const lastPass = Math.floor((to - playStart) / length);
    for (let k = firstPass; k <= lastPass; k += 1) {
      const base = playStart + k * length;
      for (const ev of events) {
        const at = base + ev.t;
        if (at >= from && at < to) emit(ev, at);
      }
    }
    scheduledUntil = to;
  }

  /** Drop the newest overdub pass (the base take is never undone this way). */
  function undoLayer(now) {
    const top = events.reduce((m, e) => Math.max(m, e.layer), 0);
    if (top === 0) return false;
    if (state === 'overdub') {
      closeOpen(now);
      state = 'playing';
    }
    events = events.filter((e) => e.layer !== top);
    layer = top - 1;
    return true;
  }

  /** A snapshot for the UI. */
  function info(now) {
    const recording = state === 'recording';
    const looping = state === 'playing' || state === 'overdub';
    return {
      state,
      length,
      elapsed: recording ? now - recStart : 0,
      position: looping ? offsetAt(now) : 0,
      count: events.length,
      layers: events.reduce((m, e) => Math.max(m, e.layer), 0),
    };
  }

  return {
    press,
    stop,
    clear: reset,
    pianoOn,
    pianoOff,
    drum,
    schedule,
    undoLayer,
    info,
    get state() { return state; },
    get events() { return events; },
    get length() { return length; },
  };
}
