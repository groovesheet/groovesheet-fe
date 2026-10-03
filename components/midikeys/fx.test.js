import { DEFAULT_FX, DEFAULT_KNOBS, FX, PAGE_COUNT, PAGE_SCREEN_NAMES, fxOnPage, knobForMessage, sanitizeFx } from './fx';

test('two pages of eight effects', () => {
  expect(PAGE_COUNT).toBe(2);
  expect(fxOnPage(0)).toHaveLength(8);
  expect(fxOnPage(1)).toHaveLength(8);
  expect(new Set(FX.map((f) => f.id)).size).toBe(16);
});

test('the eight Launchkey knobs (CC 21-28) turn the page shown, left to right', () => {
  expect(knobForMessage(DEFAULT_KNOBS, [0xbf, 21, 127], 0)).toMatchObject({ id: 'drive', value: 1, slot: 0 });
  expect(knobForMessage(DEFAULT_KNOBS, [0xb0, 28, 0], 0)).toMatchObject({ id: 'reverb', slot: 7 }); // any channel
  expect(knobForMessage(DEFAULT_KNOBS, [0xbf, 21, 64], 1)).toMatchObject({ id: 'chorus', slot: 0 });
  expect(knobForMessage(DEFAULT_KNOBS, [0xbf, 28, 64], 1)).toMatchObject({ id: 'feedback', slot: 7 });
  expect(knobForMessage(DEFAULT_KNOBS, [0xbf, 29, 64], 0)).toBeNull();
});

test('the mod wheel, sustain, buttons and notes are not knobs', () => {
  expect(knobForMessage(DEFAULT_KNOBS, [0xb0, 1, 64])).toBeNull();
  expect(knobForMessage(DEFAULT_KNOBS, [0xb0, 64, 127])).toBeNull();
  expect(knobForMessage(DEFAULT_KNOBS, [0xbf, 117, 127])).toBeNull();
  expect(knobForMessage(DEFAULT_KNOBS, [0x90, 21, 100])).toBeNull();
});

test('a learnt control turns its effect on any page, and only on its own channel', () => {
  const knobs = DEFAULT_KNOBS.map((k) => (k.id === 'ring' ? { ...k, cc: 74, channel: 0 } : k));
  expect(knobForMessage(knobs, [0xb0, 74, 64], 0)).toMatchObject({ id: 'ring', page: 1, slot: 3 });
  expect(knobForMessage(knobs, [0xb1, 74, 64], 0)).toBeNull();
  // learnt onto a knob's own CC, it wins over the page
  const onKnob = DEFAULT_KNOBS.map((k) => (k.id === 'reverb' ? { ...k, cc: 21, channel: null } : k));
  expect(knobForMessage(onKnob, [0xbf, 21, 64], 1).id).toBe('reverb');
});

test('saved effects are clamped; bindings saved before pages become the page default', () => {
  const oldSave = FX.filter((f) => f.page === 0).map((f, i) => ({ id: f.id, cc: 21 + i, channel: null }));
  const { values, knobs } = sanitizeFx({ drive: 3, reverb: 'x' }, [...oldSave, { id: 'comp', cc: 500 }, { id: 'pan', cc: 80, channel: 2 }]);
  expect(values.drive).toBe(1);
  expect(values.reverb).toBe(DEFAULT_FX.reverb);
  expect(knobs.find((k) => k.id === 'drive').cc).toBeNull();
  expect(knobs.find((k) => k.id === 'comp').cc).toBeNull();
  expect(knobs.find((k) => k.id === 'pan')).toEqual({ id: 'pan', cc: 80, channel: 2 });
});

test('every effect formats its value for the panel and the screen', () => {
  FX.forEach((f) => expect(typeof f.fmt(f.def)).toBe('string'));
  expect(FX.find((f) => f.id === 'treble').fmt(0.5)).toBe('0 dB');
  expect(FX.find((f) => f.id === 'lowpass').fmt(1)).toBe('20 kHz');
  expect(FX.find((f) => f.id === 'rate').fmt(0.5)).toBe('1.00x');
});

test('page names fit the Launchkey screen', () => {
  PAGE_SCREEN_NAMES.forEach((n) => expect(n).toMatch(/^[\x20-\x7e]{1,18}$/));
});
