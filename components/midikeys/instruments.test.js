import { GM_FAMILIES, GM_INSTRUMENTS, instrumentForProgram, sampleUrl } from './instruments';
import { ALL_SOUNDS, isKnownSound, soundById, soundTitle, stepSound } from './soundEngine';

test('all 128 General MIDI instruments, sixteen families of eight, in program order', () => {
  expect(GM_FAMILIES).toHaveLength(16);
  expect(GM_INSTRUMENTS).toHaveLength(128);
  expect(new Set(GM_INSTRUMENTS.map((i) => i.id)).size).toBe(128);
  expect(GM_INSTRUMENTS.map((i) => i.program)).toEqual([...Array(128).keys()]);
  expect(instrumentForProgram(0).id).toBe('acoustic_grand_piano');
  expect(instrumentForProgram(40).id).toBe('violin');
  expect(instrumentForProgram(128)).toBeNull();
});

test('instrument names read as words', () => {
  expect(instrumentForProgram(40).label).toBe('Violin');
  expect(instrumentForProgram(80).label).toBe('Lead 1: square');
  expect(instrumentForProgram(87).label).toBe('Lead 8: bass + lead');
  expect(GM_INSTRUMENTS.every((i) => !i.label.includes('_') && !i.label.includes('  '))).toBe(true);
});

test('each sample set has its own URL, and an unknown set falls back to MusyngKite', () => {
  expect(sampleUrl('violin', 'FatBoy')).toBe('https://gleitz.github.io/midi-js-soundfonts/FatBoy/violin-mp3.js');
  expect(sampleUrl('violin', 'FluidR3_GM')).toContain('/FluidR3_GM/');
  expect(sampleUrl('violin', 'nope')).toContain('/MusyngKite/');
});

test('favourites and GM ids are both selectable sounds', () => {
  expect(isKnownSound('aluminium_bandpass')).toBe(true);
  expect(isKnownSound('cello')).toBe(true);
  expect(isKnownSound('kazoo')).toBe(false);
  expect(soundById('cello').label).toBe('Cello');
});

test('each sound is listed once; ours sit right after the instrument they are built on', () => {
  expect(new Set(ALL_SOUNDS.map((x) => x.id)).size).toBe(ALL_SOUNDS.length);
  const i = ALL_SOUNDS.findIndex((x) => x.id === 'vibraphone');
  expect(ALL_SOUNDS[i + 1].id).toBe('aluminium_bandpass');
  expect(soundTitle(soundById('vibraphone'))).toBe('12. Vibraphone');
  expect(soundTitle(soundById('aluminium_bandpass'))).toBe('Aluminium band-pass');
});

test('Track left / right step through the menu and wrap round', () => {
  expect(stepSound('acoustic_grand_piano', 1)).toBe('bright_acoustic_piano');
  expect(stepSound('vibraphone', 1)).toBe('aluminium_bandpass');
  expect(stepSound('acoustic_grand_piano', -1)).toBe('gunshot');
  expect(stepSound('gunshot', 1)).toBe('acoustic_grand_piano');
});
