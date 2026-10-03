import { DEFAULT_GRID, GRID_NOTES, isGridNote, padNote, familyOf, restColor, hitColor, sanitizeGrid, SIDE } from './layout';
import { DRUM_VOICES, voiceById } from '../midikeys/drumKit';

test('the grid is the Launchpad MK2 Session layout: row * 10 + column from the bottom left', () => {
  expect(padNote(1, 1)).toBe(11);
  expect(padNote(8, 8)).toBe(88);
  expect(GRID_NOTES).toHaveLength(64);
  expect(GRID_NOTES[0]).toBe(81); // drawn top row first
  expect(GRID_NOTES[63]).toBe(18);
  expect(isGridNote(19)).toBe(false); // a round side button
  expect(isGridNote(SIDE.loop)).toBe(false);
  expect(isGridNote(10)).toBe(false);
});

test('every pad has a drum, and every drum in the kit is on a pad', () => {
  expect(GRID_NOTES.every((n) => voiceById(DEFAULT_GRID[n]))).toBe(true);
  const placed = new Set(Object.values(DEFAULT_GRID));
  expect(DRUM_VOICES.filter((v) => !placed.has(v.id)).map((v) => v.id)).toEqual([]);
  expect(DEFAULT_GRID[11]).toBe('kick');
  expect(DEFAULT_GRID[13]).toBe('snare');
  expect(DEFAULT_GRID[21]).toBe('hatClosed');
});

test('pads light by drum family, dim at rest and bright when hit', () => {
  expect(familyOf('kick808')).toBe('kick');
  expect(familyOf('rideBell')).toBe('cymbal');
  expect(familyOf('guiroLong')).toBe('shaker');
  expect(restColor('kick')).toBe(7);
  expect(hitColor('kick')).toBe(5);
  expect(restColor(null)).toBe(0);
});

test('a saved grid keeps known pads and drums only', () => {
  const g = sanitizeGrid({ 11: 'cowbell', 99: 'kick', 12: 'nope' });
  expect(g[11]).toBe('cowbell');
  expect(g[12]).toBe('kick');
  expect(g[99]).toBeUndefined();
});
