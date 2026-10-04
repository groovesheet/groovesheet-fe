import { frame, liveWaves, makeWave, rgbMessages, paletteFor, effectFor, FAMILY_RGB, FAMILY_EFFECT, EFFECTS } from './ripple';
import { DEFAULT_GRID } from './layout';

const glowAt = (f, note) => f.glow.get(note);

test('a ripple lights the hit pad first, then a ring that moves outward and fades', () => {
  const w = makeWave(44, 'kick', 0); // row 4, column 4
  const t0 = frame(0, [w], DEFAULT_GRID);
  expect(glowAt(t0, 44)).toBeCloseTo(1);
  expect(glowAt(t0, 48)).toBeLessThan(0.01); // 4 pads away: not reached yet
  const t = 4 / 18; // the front reaches 4 pads away
  const later = frame(t, [w], DEFAULT_GRID);
  expect(glowAt(later, 48)).toBeGreaterThan(glowAt(later, 45)); // the ring has passed the near pad
  expect(glowAt(later, 84)).toBeGreaterThan(0.2); // straight up, same distance
  expect(frame(2, [w], DEFAULT_GRID).glow.get(48)).toBe(0); // long gone
});

test('each shape only lights the pads on its path', () => {
  const lit = (shape, t) => {
    const f = frame(t, [makeWave(44, 'snare', 0, 1, shape)], DEFAULT_GRID);
    return (note) => f.glow.get(note) > 0.2;
  };
  const plus = lit('plus', 2 / 18);
  expect([plus(46), plus(64), plus(66)]).toEqual([true, true, false]); // row, column, not diagonal
  const x = lit('x', 2 / 18);
  expect([x(66), x(22), x(46)]).toEqual([true, true, false]); // diagonals only
  const star = lit('star', 2 / 18);
  expect([star(46), star(66), star(65)]).toEqual([true, true, false]);
  const square = lit('square', 3 / 18);
  expect([square(77), square(74), square(55)]).toEqual([true, true, false]); // the ring three out (corner and edge), not one
  const diamond = lit('diamond', 2 / 18);
  expect([diamond(46), diamond(55), diamond(66)]).toEqual([true, true, false]);
  const rise = lit('rise', 2 / 18);
  expect([rise(64), rise(24), rise(46)]).toEqual([true, false, false]); // up the column only
  const off = lit('off', 2 / 18);
  expect(off(46)).toBe(false);
});

test('a twinkle sparkles some pads near the hit, the same ones every frame', () => {
  const w = makeWave(44, 'shaker', 0, 1, 'twinkle');
  const near = new Set();
  for (let t = 0; t < 0.45; t += 0.02) {
    frame(t, [w], DEFAULT_GRID).glow.forEach((g, note) => { if (g > 0.3 && note !== 44) near.add(note); });
  }
  expect(near.size).toBeGreaterThan(4);
  expect([...near].every((n) => Math.abs(Math.floor(n / 10) - 4) <= 3 && Math.abs((n % 10) - 4) <= 3)).toBe(true);
  expect(frame(0.2, [w], DEFAULT_GRID).glow).toEqual(frame(0.2, [w], DEFAULT_GRID).glow);
});

test('each kind of drum has its own shape, a pad can override it, one setting can rule all', () => {
  expect(new Set(Object.values(FAMILY_EFFECT)).size).toBe(8);
  expect(Object.values(FAMILY_EFFECT).every((id) => EFFECTS.some((e) => e.id === id))).toBe(true);
  expect(effectFor('mixed', null, 'kick')).toBe('ripple');
  expect(effectFor('mixed', null, 'snare')).toBe('x');
  expect(effectFor('mixed', null, 'hatClosed')).toBe('plus');
  expect(effectFor('mixed', 'rise', 'kick')).toBe('rise');
  expect(effectFor('star', 'rise', 'kick')).toBe('star');
});

test('pads rest dark unless resting colours are on', () => {
  expect(frame(0, [], DEFAULT_GRID).colors.get(11)).toEqual([0, 0, 0]);
});

test('the hit pad flashes white, then holds its colour', () => {
  const w = makeWave(11, 'kick', 0);
  const strike = frame(0, [w], DEFAULT_GRID).colors.get(11);
  expect(strike[1]).toBeGreaterThan(30); // white mixed into the red
  const held = frame(0.05, [w], DEFAULT_GRID).colors.get(11);
  expect(held[0]).toBe(63);
  expect(held[1]).toBeLessThan(strike[1] / 2); // the white has mostly gone
});

test('with resting colours a pad sits on a dim version of its own, and waves never overflow 63', () => {
  const rest = frame(0, [], DEFAULT_GRID, { rest: true }).colors.get(11); // a kick
  expect(rest[0]).toBeGreaterThan(rest[1]);
  expect(rest[0]).toBeLessThan(FAMILY_RGB.kick[0] / 2);
  const many = Array.from({ length: 10 }, () => makeWave(11, 'kick', 0));
  expect(Math.max(...frame(0, many, DEFAULT_GRID).colors.get(11))).toBe(63);
});

test('loop replays scheduled ahead wait their turn, and finished waves are dropped', () => {
  const future = makeWave(11, 'kick', 1);
  expect(frame(0.5, [future], DEFAULT_GRID).glow.get(11)).toBe(0);
  expect(liveWaves([makeWave(11, 'kick', 0), future], 1.5)).toEqual([future]);
  expect(liveWaves([makeWave(11, 'kick', 0)], 0.5)).toHaveLength(1);
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

test('light is gone within about half a second, and Fade stretches it without slowing the wave', () => {
  const w = makeWave(44, 'kick', 0);
  expect(Math.max(...frame(0.3, [w], DEFAULT_GRID).glow.values())).toBeLessThan(0.25);
  expect(Math.max(...frame(0.6, [w], DEFAULT_GRID).glow.values())).toBe(0);
  expect(liveWaves([w], 0.6)).toEqual([]);
  // at Fade x2 it still lights at 0.6 s, and the ring is in the same place at 0.1 s
  expect(Math.max(...frame(0.6, [w], DEFAULT_GRID, { fade: 2 }).glow.values())).toBeGreaterThan(0);
  const ringAt = (f) => [...f.glow.entries()].filter(([n]) => n !== 44).sort((a, b) => b[1] - a[1])[0][0];
  expect(Math.floor(ringAt(frame(0.1, [w], DEFAULT_GRID, { fade: 2 })) / 10)).toBe(Math.floor(ringAt(frame(0.1, [w], DEFAULT_GRID)) / 10));
});
