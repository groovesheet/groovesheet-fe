import { actionFor, DEFAULT_BINDINGS, pressFromMessage, sanitizeBindings, describeBinding } from './bindings';
import { DEFAULT_PAD_MAP, PAD_ROWS, voiceForNote, DRUM_VOICES } from './drumKit';

test('the Launchkey Play button (MIDI Start) is the loop button, Stop stops', () => {
  expect(actionFor(DEFAULT_BINDINGS, pressFromMessage([0xfa]))).toBe('loop');
  expect(actionFor(DEFAULT_BINDINGS, pressFromMessage([0xfc]))).toBe('stop');
});

test('Record and Loop (CC 117 / 118 on channel 16) also work the looper, on press only', () => {
  expect(actionFor(DEFAULT_BINDINGS, pressFromMessage([0xbf, 117, 127]))).toBe('loop');
  expect(actionFor(DEFAULT_BINDINGS, pressFromMessage([0xbf, 118, 127]))).toBe('loop');
  expect(pressFromMessage([0xbf, 117, 0])).toBeNull(); // the release
});

test('keys, sustain and MIDI clock are never mistaken for buttons', () => {
  expect(actionFor(DEFAULT_BINDINGS, pressFromMessage([0x90, 60, 100]))).toBeNull();
  expect(pressFromMessage([0xb0, 64, 127])).toBeNull();
  expect(pressFromMessage([0xb0, 1, 127], { strict: true })).toBeNull(); // mod wheel at the top
  expect(pressFromMessage([0xe0, 0, 127])).toBeNull(); // pitch wheel
  expect(pressFromMessage([0xf8])).toBeNull();
});

test('learning ignores a knob turned part way', () => {
  expect(pressFromMessage([0xbf, 21, 70], { strict: true })).toBeNull();
  expect(pressFromMessage([0xbf, 75, 127], { strict: true })).toEqual({ kind: 'cc', channel: 15, cc: 75 });
});

test('saved bindings that are malformed fall back to the defaults', () => {
  const out = sanitizeBindings({ loop: [{ kind: 'cc', cc: 'x' }], stop: [{ kind: 'note', channel: 9, note: 51 }] });
  expect(out.loop).toEqual(DEFAULT_BINDINGS.loop);
  expect(out.stop).toEqual([{ kind: 'note', channel: 9, note: 51 }]);
  expect(describeBinding(out.stop[0])).toBe('D#3 · ch 10');
});

test('each of the 16 pads starts on its General MIDI drum', () => {
  expect(PAD_ROWS.flat()).toHaveLength(16);
  expect(DEFAULT_PAD_MAP[36]).toBe('kick');
  expect(DEFAULT_PAD_MAP[38]).toBe('snare');
  expect(DEFAULT_PAD_MAP[42]).toBe('hatClosed');
  expect(DEFAULT_PAD_MAP[49]).toBe('crash');
  expect(new Set(Object.values(DEFAULT_PAD_MAP)).size).toBe(16); // no two pads share a sound
});

test('a reassigned pad plays its new voice; other drum notes fall back to GM', () => {
  const map = { ...DEFAULT_PAD_MAP, 36: 'kick808' };
  expect(voiceForNote(map, 36)).toBe('kick808');
  expect(voiceForNote(map, 56)).toBe('cowbell');
  expect(voiceForNote(map, 100)).toBeNull();
  expect(DRUM_VOICES.every((v) => typeof v.gm === 'number')).toBe(true);
});

test('the Track buttons step the sound, and the knob page starts unassigned', () => {
  expect(actionFor(DEFAULT_BINDINGS, pressFromMessage([0xbf, 103, 127]))).toBe('prevSound');
  expect(actionFor(DEFAULT_BINDINGS, pressFromMessage([0xbf, 102, 127]))).toBe('nextSound');
  expect(describeBinding(DEFAULT_BINDINGS.nextSound[0])).toBe('Track ►');
  expect(DEFAULT_BINDINGS.knobPage).toEqual([]);
  expect(sanitizeBindings({ knobPage: [] }).knobPage).toEqual([]);
  expect(sanitizeBindings({ loop: [] }).loop).toEqual(DEFAULT_BINDINGS.loop); // the loop button can't be lost
});
