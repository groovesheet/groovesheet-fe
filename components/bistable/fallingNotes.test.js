import { createNoteScheduler, normaliseNotes, MIN_SOUND_SEC } from './fallingNotes';

const midiNotes = [
  { time: 1, duration: 1, midi: 60, velocity: 0.8 }, // 1..2
  { time: 1.5, duration: 2, midi: 64, velocity: 1 }, // 1.5..3.5 (overlaps 60)
  { time: 5, duration: 0, midi: 67, velocity: 0.5 }, // zero-length
];

test('scales @tonejs/midi 0..1 velocities into the 1..127 the keyboard speaks', () => {
  const [a, b] = normaliseNotes(midiNotes);
  expect(a.velocity).toBe(102);
  expect(b.velocity).toBe(127);
});

test('gives a zero-length note a floor so it still lights its key', () => {
  const s = createNoteScheduler(midiNotes);
  expect(s.heldAt(5).get(67)).toBeGreaterThan(0);
  expect(s.heldAt(5 + MIN_SOUND_SEC / 2).has(67)).toBe(true);
  expect(s.heldAt(5 + MIN_SOUND_SEC * 2).has(67)).toBe(false);
});

test('reports overlapping notes as simultaneously held', () => {
  const held = createNoteScheduler(midiNotes).heldAt(1.75);
  expect([...held.keys()].sort((x, y) => x - y)).toEqual([60, 64]);
});

test('is a pure function of t, so seeking backwards resolves identically', () => {
  const s = createNoteScheduler(midiNotes);
  const forward = s.heldAt(1.75);
  s.heldAt(9); // scrub to the end...
  s.heldAt(0); // ...and back past the start
  expect([...s.heldAt(1.75)]).toEqual([...forward]);
});

test('holds nothing in the gaps and before the first note', () => {
  const s = createNoteScheduler(midiNotes);
  expect(s.heldAt(0).size).toBe(0);
  expect(s.heldAt(4).size).toBe(0);
  expect(s.heldAt(100).size).toBe(0);
});

test('a note is held at its onset but released exactly at its end', () => {
  const s = createNoteScheduler([{ time: 1, duration: 1, midi: 60, velocity: 0.8 }]);
  expect(s.heldAt(1).has(60)).toBe(true);
  expect(s.heldAt(1.999).has(60)).toBe(true);
  expect(s.heldAt(2).has(60)).toBe(false);
});

test('visibleRange spans notes still sounding plus the lookahead window', () => {
  const s = createNoteScheduler(midiNotes);
  // 60 started before t and still sounds, so the range reaches back to it;
  // 67 at t=5 is beyond the 4.75s horizon and stays culled.
  expect(s.visibleRange(1.75, 3)).toEqual({ start: 0, end: 2 });
  // Widening the lookahead past 5s pulls it in.
  expect(s.visibleRange(1.75, 3.5).end).toBe(3);
});

test('survives an empty or malformed note list', () => {
  const s = createNoteScheduler([]);
  expect(s.heldAt(1).size).toBe(0);
  expect(s.duration).toBe(0);
  const junk = createNoteScheduler([null, { time: NaN, midi: 60 }, { midi: 60 }]);
  expect(junk.notes).toHaveLength(0);
});

test('reports total duration from the last note end, not the last onset', () => {
  // The last onset is 5; its zero length is floored to MIN_SOUND_SEC.
  expect(createNoteScheduler(midiNotes).duration).toBeCloseTo(5 + MIN_SOUND_SEC);
  // A long early note outlasting later onsets still sets the duration.
  expect(createNoteScheduler([
    { time: 0, duration: 30, midi: 60 },
    { time: 2, duration: 1, midi: 64 },
  ]).duration).toBeCloseTo(30);
});
