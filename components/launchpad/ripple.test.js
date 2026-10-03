import { frame, liveWaves, makeWave, rgbMessages, paletteFor, FAMILY_RGB } from './ripple';
import { DEFAULT_GRID } from './layout';

const glowAt = (f, note) => f.glow.get(note);

test('a ripple lights the hit pad first, then a ring that moves outward and fades', () => {
  const w = makeWave(44, 'kick', 0); // row 4, column 4
  const t0 = frame(0, [w], DEFAULT_GRID, 'ripple');
  expect(glowAt(t0, 44)).toBeCloseTo(1);
  expect(glowAt(t0, 48)).toBeLessThan(0.01); // 4 pads away: not reached yet
  const t = 4 / 11; // the front reaches 4 pads away
  const later = frame(t, [w], DEFAULT_GRID, 'ripple');
  expect(glowAt(later, 48)).toBeGreaterThan(glowAt(later, 45)); // the ring has passed the near pad
  expect(glowAt(later, 84)).toBeGreaterThan(0.2); // straight up, same distance
  expect(frame(2, [w], DEFAULT_GRID, 'ripple').glow.get(48)).toBe(0); // long gone
});

test("a cross only runs along the hit pad's row and column", () => {
  const w = makeWave(44, 'snare', 0);
  const f = frame(2 / 11, [w], DEFAULT_GRID, 'cross');
  expect(glowAt(f, 46)).toBeGreaterThan(0.2); // same row
  expect(glowAt(f, 64)).toBeGreaterThan(0.2); // same column
  expect(glowAt(f, 66)).toBe(0); // diagonal
});

test('pads rest dark unless resting colours are on', () => {
  expect(frame(0, [], DEFAULT_GRID).colors.get(11)).toEqual([0, 0, 0]);
});

test('the hit pad flashes white, then holds its colour', () => {
  const w = makeWave(11, 'kick', 0);
  const strike = frame(0, [w], DEFAULT_GRID).colors.get(11);
  expect(strike[1]).toBeGreaterThan(30); // white mixed into the red
  const held = frame(0.1, [w], DEFAULT_GRID).colors.get(11);
  expect(held[0]).toBe(63);
  expect(held[1]).toBeLessThan(20); // the white has mostly gone
});

test('with resting colours a pad sits on a dim version of its own, and waves never overflow 63', () => {
  const rest = frame(0, [], DEFAULT_GRID, 'ripple', { rest: true }).colors.get(11); // a kick
  expect(rest[0]).toBeGreaterThan(rest[1]);
  expect(rest[0]).toBeLessThan(FAMILY_RGB.kick[0] / 2);
  const many = Array.from({ length: 10 }, () => makeWave(11, 'kick', 0));
  expect(Math.max(...frame(0, many, DEFAULT_GRID).colors.get(11))).toBe(63);
});

test('loop replays scheduled ahead wait their turn, and finished waves are dropped', () => {
  const future = makeWave(11, 'kick', 1);
  expect(frame(0.5, [future], DEFAULT_GRID).glow.get(11)).toBe(0);
  expect(liveWaves([makeWave(11, 'kick', 0), future], 1.5)).toEqual([future]);
  expect(liveWaves([makeWave(11, 'kick', 0)], 0.9)).toHaveLength(1);
});

test('RGB updates go out as MK2 SysEx, at most 80 pads a message', () => {
  const changes = new Map(Array.from({ length: 64 }, (_, i) => [11 + i, [1, 2, 3]]));
  const msgs = rgbMessages(changes);
  expect(msgs).toHaveLength(1);
  expect(msgs[0].slice(0, 7)).toEqual([0xf0, 0x00, 0x20, 0x29, 0x02, 0x18, 0x0b]);
  expect(msgs[0].slice(7, 11)).toEqual([11, 1, 2, 3]);
  expect(msgs[0]).toHaveLength(7 + 64 * 4 + 1);
  expect(paletteFor(0.9, 5, 7, 7)).toBe(5);
  expect(paletteFor(0.05, 5, 7, 7)).toBe(7);
});
