/**
 * Which controller buttons drive the looper on /midi-keyboard.
 *
 * Launchkey MK4 in Standalone (MIDI) mode, per the Programmer's Reference
 * Guide: Play and Stop send the MIDI Real Time Start (FAh) and Stop (FCh)
 * messages, and the other DAW buttons send Control Changes on channel 16
 * (Record CC 117, Loop CC 118), 127 on press and 0 on release. So by default:
 *
 *   loop button  = Play (Start), Record, Loop
 *   stop / clear = Stop
 *   sound - / +  = Track left / right (CC 103 / 102)
 *   knob page    = nothing: the page buttons beside the knobs send no MIDI in
 *                  Standalone mode, so it is learnt from a spare button
 *   drum page    = nothing, for the same reason: the arrows beside the pads
 *                  shift the pads on the keyboard itself and send no message
 *
 * A binding is one of
 *   { kind: 'rt', status }          a real-time message (FAh Start, FBh Continue, FCh Stop)
 *   { kind: 'cc', channel, cc }     a Control Change, fired on a non-zero value
 *   { kind: 'note', channel, note } a note-on (a pad or a spare key)
 * and any action can be re-learnt from the next button pressed.
 */

export const RT_START = 0xfa;
export const RT_CONTINUE = 0xfb;
export const RT_STOP = 0xfc;
const LK_CHANNEL = 15; // channel 16, zero-based

export const ACTIONS = ['loop', 'stop', 'prevSound', 'nextSound', 'knobPage', 'drumPage'];

export const DEFAULT_BINDINGS = {
  loop: [
    { kind: 'rt', status: RT_START },
    { kind: 'cc', channel: LK_CHANNEL, cc: 117 },
    { kind: 'cc', channel: LK_CHANNEL, cc: 118 },
  ],
  stop: [{ kind: 'rt', status: RT_STOP }],
  prevSound: [{ kind: 'cc', channel: LK_CHANNEL, cc: 103 }],
  nextSound: [{ kind: 'cc', channel: LK_CHANNEL, cc: 102 }],
  knobPage: [],
  drumPage: [],
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteLabel = (n) => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;

/**
 * Read a raw MIDI message as a possible button press, or null. Releases (CC
 * value 0, note-off) are not presses. With `strict`, used while learning, a CC
 * only counts at full value 127, which is what buttons send, so nudging a knob
 * or fader by accident cannot be learnt as the loop button.
 */
export function pressFromMessage(data, { strict = false } = {}) {
  const status = data[0];
  if (status === RT_START || status === RT_CONTINUE || status === RT_STOP) return { kind: 'rt', status };
  if (status >= 0xf0) return null;
  const cmd = status & 0xf0;
  const channel = status & 0x0f;
  if (cmd === 0xb0) {
    const value = data[2];
    // The mod wheel, sustain and the "all notes off" family are never buttons
    // (a mod wheel pushed all the way sends 127, just like a button).
    if (data[1] === 1 || data[1] === 64 || data[1] >= 120) return null;
    if (strict ? value !== 127 : value === 0) return null;
    return { kind: 'cc', channel, cc: data[1] };
  }
  if (cmd === 0x90 && data[2] > 0) return { kind: 'note', channel, note: data[1] };
  return null;
}

export function sameBinding(a, b) {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'rt') return a.status === b.status;
  if (a.kind === 'cc') return a.channel === b.channel && a.cc === b.cc;
  return a.channel === b.channel && a.note === b.note;
}

/** The action a press triggers, or null. */
export function actionFor(bindings, press) {
  if (!press) return null;
  for (const action of ACTIONS) {
    if ((bindings[action] || []).some((b) => sameBinding(b, press))) return action;
  }
  return null;
}

/** Human name for a binding, Launchkey buttons by their printed names. */
export function describeBinding(b) {
  if (b.kind === 'rt') {
    if (b.status === RT_START) return 'Play ▶';
    if (b.status === RT_STOP) return 'Stop ■';
    return 'Continue';
  }
  if (b.kind === 'cc') {
    if (b.channel === LK_CHANNEL && b.cc === 117) return 'Record ●';
    if (b.channel === LK_CHANNEL && b.cc === 118) return 'Loop';
    if (b.channel === LK_CHANNEL && b.cc === 103) return 'Track ◄';
    if (b.channel === LK_CHANNEL && b.cc === 102) return 'Track ►';
    return `CC ${b.cc} · ch ${b.channel + 1}`;
  }
  return `${noteLabel(b.note)} · ch ${b.channel + 1}`;
}

/** Restore saved bindings, dropping anything malformed. */
export function sanitizeBindings(saved) {
  const valid = (b) => b && (
    (b.kind === 'rt' && [RT_START, RT_CONTINUE, RT_STOP].includes(b.status))
    || (b.kind === 'cc' && Number.isInteger(b.cc) && Number.isInteger(b.channel))
    || (b.kind === 'note' && Number.isInteger(b.note) && Number.isInteger(b.channel))
  );
  const out = {};
  for (const action of ACTIONS) {
    const list = Array.isArray(saved?.[action]) ? saved[action].filter(valid) : null;
    out[action] = list && (list.length || !DEFAULT_BINDINGS[action].length) ? list : DEFAULT_BINDINGS[action];
  }
  return out;
}
