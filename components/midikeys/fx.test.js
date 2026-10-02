import { DEFAULT_FX, DEFAULT_KNOBS, FX, knobForMessage, sanitizeFx } from './fx';

test('the eight Launchkey knobs (CC 21-28) turn the effects left to right', () => {
  expect(DEFAULT_KNOBS.map((k) => k.cc)).toEqual([21, 22, 23, 24, 25, 26, 27, 28]);
  expect(knobForMessage(DEFAULT_KNOBS, [0xbf, 21, 127])).toEqual({ id: 'drive', value: 1 });
  expect(knobForMessage(DEFAULT_KNOBS, [0xb0, 28, 0])).toEqual({ id: 'reverb', value: 0 }); // any channel
});

test('the mod wheel, sustain, buttons and notes are not knobs', () => {
  expect(knobForMessage(DEFAULT_KNOBS, [0xb0, 1, 64])).toBeNull();
  expect(knobForMessage(DEFAULT_KNOBS, [0xb0, 64, 127])).toBeNull();
  expect(knobForMessage(DEFAULT_KNOBS, [0xbf, 117, 127])).toBeNull();
  expect(knobForMessage(DEFAULT_KNOBS, [0x90, 21, 100])).toBeNull();
});

test('a learnt knob is bound to its channel, an unassigned one to nothing', () => {
  const knobs = DEFAULT_KNOBS.map((k) => (k.id === 'phaser' ? { ...k, cc: 74, channel: 0 } : k.id === 'drive' ? { ...k, cc: null } : k));
  expect(knobForMessage(knobs, [0xb0, 74, 64]).id).toBe('phaser');
  expect(knobForMessage(knobs, [0xb1, 74, 64])).toBeNull();
  expect(knobForMessage(knobs, [0xbf, 21, 64])).toBeNull();
});

test('saved effects are clamped and malformed bindings fall back', () => {
  const { values, knobs } = sanitizeFx({ drive: 3, reverb: 'x' }, [{ id: 'drive', cc: null }, { id: 'bass', cc: 500 }]);
  expect(values.drive).toBe(1);
  expect(values.reverb).toBe(DEFAULT_FX.reverb);
  expect(knobs.find((k) => k.id === 'drive').cc).toBeNull();
  expect(knobs.find((k) => k.id === 'bass').cc).toBe(23);
});

test('every effect formats its value for the panel', () => {
  FX.forEach((f) => expect(typeof f.fmt(f.def)).toBe('string'));
  expect(FX.find((f) => f.id === 'treble').fmt(0.5)).toBe('0 dB');
  expect(FX.find((f) => f.id === 'treble').fmt(1)).toBe('+12.0 dB');
});
