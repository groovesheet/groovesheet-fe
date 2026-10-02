import {
  DEFAULT_FADER_BINDINGS, DEFAULT_FADERS, FADERS, faderForLayer, faderForMessage, faderGain, faderLabel, gainToFader, sanitizeFaders,
} from './faders';

test('nine faders on CC 5-13, channel 16, left to right', () => {
  expect(FADERS.map((f) => f.id)).toEqual(['keys', 'drums', 'layer0', 'layer1', 'layer2', 'layer3', 'layer4', 'loop', 'master']);
  expect(DEFAULT_FADER_BINDINGS.map((b) => b.cc)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13]);
  expect(faderForMessage(DEFAULT_FADER_BINDINGS, [0xbf, 5, 127])).toEqual({ id: 'keys', value: 1, slot: 0 });
  expect(faderForMessage(DEFAULT_FADER_BINDINGS, [0xbf, 13, 0])).toMatchObject({ id: 'master', slot: 8 });
});

test("CC 7 and 11 on the keys' channel are not faders", () => {
  expect(faderForMessage(DEFAULT_FADER_BINDINGS, [0xb0, 7, 100])).toBeNull();
  expect(faderForMessage(DEFAULT_FADER_BINDINGS, [0xb0, 11, 100])).toBeNull();
});

test('the taper puts unity near the top and silence at the bottom', () => {
  expect(faderGain(0)).toBe(0);
  expect(faderGain(0.9)).toBeCloseTo(1.0125, 3);
  expect(gainToFader(faderGain(0.5))).toBeCloseTo(0.5);
  expect(faderLabel(0)).toBe('-inf');
  expect(faderLabel(0.9)).toBe('+0.1 dB');
});

test('layers five and up share the last layer fader', () => {
  expect(faderForLayer(0)).toBe('layer0');
  expect(faderForLayer(3)).toBe('layer3');
  expect(faderForLayer(9)).toBe('layer4');
});

test('levels saved as gains before the faders carry over', () => {
  const { values } = sanitizeFaders(null, null, { master: 1, piano: 0.5, drums: undefined, loop: 1.25 });
  expect(values.master).toBeCloseTo(gainToFader(1));
  expect(values.keys).toBeCloseTo(gainToFader(0.5));
  expect(values.drums).toBe(DEFAULT_FADERS.drums);
  expect(values.loop).toBe(1);
});

test('a learnt fader keeps its control; one given away stays unassigned', () => {
  const { bindings } = sanitizeFaders({}, [{ id: 'keys', cc: 74, channel: 0 }, { id: 'drums', cc: null }]);
  expect(bindings[0]).toEqual({ id: 'keys', cc: 74, channel: 0 });
  expect(bindings[1].cc).toBeNull();
  expect(faderForMessage(bindings, [0xb0, 74, 64]).id).toBe('keys');
});
