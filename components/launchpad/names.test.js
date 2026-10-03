import { DRUM_ZH, FAMILY_ZH, drumName, familyName } from './names';
import { DRUM_VOICES } from '../midikeys/drumKit';
import { FAMILIES } from './layout';

test('every drum and family has a Chinese name, all different', () => {
  expect(DRUM_VOICES.filter((v) => !DRUM_ZH[v.id]).map((v) => v.id)).toEqual([]);
  expect(new Set(Object.values(DRUM_ZH)).size).toBe(DRUM_VOICES.length);
  expect(Object.keys(FAMILIES).every((f) => FAMILY_ZH[f])).toBe(true);
});

test('names follow the page language', () => {
  expect(drumName('kick', 'zh')).toBe('底鼓');
  expect(drumName('ride', 'zh')).toBe('叮叮镲');
  expect(drumName('tom1', 'en')).toBe('Floor tom');
  expect(drumName(null, 'zh')).toBe('—');
  expect(familyName('hat', 'zh')).toBe('踩镲');
  expect(familyName('hat', 'en')).toBe('Hi-hats');
});
