import { findLaunchkeyOutput, screenText, showLines, SKU_MINI, SKU_REGULAR, TARGET_GLOBAL } from './launchkeyDisplay';

test('three lines go to the display as configure, three texts, trigger', () => {
  const msgs = showLines(SKU_REGULAR, TARGET_GLOBAL, ['Sound', '57. Trumpet', 'FatBoy']);
  expect(msgs).toHaveLength(5);
  expect(msgs[0]).toEqual([0xf0, 0x00, 0x20, 0x29, 0x02, 0x14, 0x04, 0x21, 0x02, 0xf7]); // arrangement 2
  expect(msgs[2].slice(0, 9)).toEqual([0xf0, 0x00, 0x20, 0x29, 0x02, 0x14, 0x06, 0x21, 0x01]);
  expect(String.fromCharCode(...msgs[2].slice(9, -1))).toBe('57. Trumpet');
  expect(msgs[4]).toEqual([0xf0, 0x00, 0x20, 0x29, 0x02, 0x14, 0x04, 0x21, 0x7f, 0xf7]);
});

test('two lines use the name + value arrangement', () => {
  expect(showLines(SKU_REGULAR, 0x15, ['Drive', '56%'])[0][8]).toBe(0x01);
});

test('text is printable ASCII, cut to what fits', () => {
  expect(screenText('Café ►')).toEqual([67, 97, 102, 32, 32, 32]);
  expect(screenText('x'.repeat(40))).toHaveLength(18);
  showLines(SKU_REGULAR, TARGET_GLOBAL, ['a', 'b', 'c']).flat().forEach((b) => expect(b).toBeLessThan(256));
});

test('the DAW port is preferred, and a Mini gets its own SysEx id', () => {
  const outs = [{ name: 'IAC Bus' }, { name: 'Launchkey MK4 49 MIDI' }, { name: 'Launchkey MK4 49 DAW' }];
  expect(findLaunchkeyOutput(outs)).toEqual({ output: outs[2], sku: SKU_REGULAR });
  expect(findLaunchkeyOutput([{ name: 'Launchkey Mini MK4 25 MIDI' }]).sku).toBe(SKU_MINI);
  expect(findLaunchkeyOutput([{ name: 'IAC Bus' }])).toBeNull();
});
