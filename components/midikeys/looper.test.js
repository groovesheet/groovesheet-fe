import { createLooper, loopEnd, MIN_LOOP_SEC } from './looper';

const collect = (looper, now, lookahead) => {
  const out = [];
  looper.schedule(now, lookahead, (ev, at) => out.push({ ev, at }));
  return out;
};

test('arming waits for the first note: the loop starts at the note, not the press', () => {
  const l = createLooper();
  l.press(10); // armed at t=10
  expect(l.state).toBe('armed');
  l.pianoOn(60, 100, 12); // first note two seconds later
  expect(l.state).toBe('recording');
  expect(l.events[0].t).toBe(0);
  l.pianoOff(60, 12.5);
  l.pianoOn(64, 90, 13);
  l.pianoOff(64, 13.5);
  l.press(16); // close the loop
  expect(l.state).toBe('playing');
  // 12 -> 13.5: the wait before the first note and the gap after the last
  // release (13.5 -> 16) are both cut
  expect(l.length).toBe(1.5);
  expect(l.events.map((e) => [e.midi, e.t, e.dur])).toEqual([[60, 0, 0.5], [64, 1, 0.5]]);
});

test('playback restarts from the first note the moment the loop is closed', () => {
  const l = createLooper();
  l.press(0);
  l.pianoOn(60, 100, 1);
  l.pianoOff(60, 1.2);
  l.drum(36, 'kick', 110, 2);
  l.press(3); // length 2
  const first = collect(l, 3, 0.1);
  expect(first).toHaveLength(1);
  expect(first[0].at).toBe(3);
  expect(first[0].ev.midi).toBe(60);
  // the kick at offset 1 sounds at 4, then both repeat every 2 s
  const rest = collect(l, 6, 0.1).map((x) => [x.ev.type, x.at]);
  expect(rest).toEqual([['drum', 4], ['piano', 5], ['drum', 6]]);
});

test('every event is handed out exactly once across window boundaries', () => {
  const l = createLooper();
  l.press(0);
  l.pianoOn(60, 100, 0);
  l.pianoOff(60, 0.1);
  l.press(1);
  const times = [];
  for (let now = 1; now < 11; now += 0.025) {
    l.schedule(now, 0.1, (ev, at) => times.push(Math.round(at * 1000) / 1000));
  }
  // passes start at 1, 2, ... 11 (the last tick's lookahead reaches 11)
  expect(times).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test('a note still held when the loop is closed runs to the end of the loop', () => {
  const l = createLooper();
  l.press(0);
  l.pianoOn(48, 100, 1);
  l.press(3);
  expect(l.events[0].dur).toBe(2);
});

test('a press straight after the first note is treated as a mis-hit and clears', () => {
  const l = createLooper();
  l.press(0);
  l.pianoOn(60, 100, 1);
  l.press(1 + MIN_LOOP_SEC / 2);
  expect(l.state).toBe('empty');
  expect(l.events).toHaveLength(0);
});

test('a second press while armed cancels', () => {
  const l = createLooper();
  l.press(0);
  l.press(1);
  expect(l.state).toBe('empty');
});

test('overdub layers notes at their position in the loop, and undo drops the layer', () => {
  const l = createLooper();
  l.press(0);
  l.pianoOn(60, 100, 0);
  l.press(4); // note still held, so no trim: 4 s loop, playing from 4
  l.pianoOff(60, 4.5);
  l.press(5); // overdub
  expect(l.state).toBe('overdub');
  l.pianoOn(67, 100, 11); // 7 s into playback = offset 3
  l.pianoOff(67, 11.5);
  expect(l.events.find((e) => e.midi === 67).t).toBeCloseTo(3);
  l.press(12);
  expect(l.state).toBe('playing');
  expect(l.undoLayer(12)).toBe(true);
  expect(l.events.map((e) => e.midi)).toEqual([60]);
  expect(l.undoLayer(12)).toBe(false); // the base take stays
});

test('stop keeps the loop, a second stop clears it, and play restarts from the top', () => {
  const l = createLooper();
  l.press(0);
  l.pianoOn(60, 100, 0);
  l.press(2);
  l.stop(3);
  expect(l.state).toBe('stopped');
  expect(collect(l, 3, 0.1)).toHaveLength(0);
  l.press(10);
  expect(l.state).toBe('playing');
  expect(collect(l, 10, 0.05).map((x) => x.at)).toEqual([10]);
  l.stop(11);
  l.stop(11.5);
  expect(l.state).toBe('empty');
  expect(l.events).toHaveLength(0);
});

test('stop while recording closes the loop instead of throwing it away', () => {
  const l = createLooper();
  l.press(0);
  l.pianoOn(60, 100, 1);
  l.stop(3);
  expect(l.state).toBe('stopped');
  expect(l.length).toBe(2);
});

test('the end is trimmed to the last release, the same as the start is trimmed to the first note', () => {
  const l = createLooper();
  l.press(0);
  l.pianoOn(60, 100, 1);
  l.pianoOff(60, 1.6);
  l.pianoOn(64, 100, 2);
  l.pianoOff(64, 2.4);
  l.press(5); // waited 2.6 s after letting go
  expect(l.length).toBeCloseTo(1.4); // 1 -> 2.4
  // and playback still starts right away, from the first note
  expect(collect(l, 5, 0.05).map((x) => x.at)).toEqual([5]);
});

test('a note held by the sustain pedal ends when the pedal comes up, not at key-up', () => {
  // the page calls pianoOff when the sound actually stops, so the trim follows the pedal
  const l = createLooper();
  l.press(0);
  l.pianoOn(48, 100, 0);
  l.pianoOff(48, 2.5); // pedal released at 2.5
  l.press(4);
  expect(l.length).toBe(2.5);
});

test('a drum-only take ends one step after the last hit, so the first hit lands on the next beat', () => {
  const l = createLooper();
  l.press(0);
  [1, 1.5, 2, 2.5].forEach((t) => l.drum(36, 'kick', 100, t));
  l.press(4.2);
  expect(l.length).toBeCloseTo(2); // four hits half a second apart
});

test('a trim that would leave less than a loop keeps the press as the end', () => {
  const l = createLooper();
  l.press(0);
  l.pianoOn(60, 100, 0);
  l.pianoOff(60, 0.1); // one quick tap
  l.press(1);
  expect(l.length).toBe(1);
});

test('the trim can be turned off', () => {
  const l = createLooper();
  l.press(0);
  l.pianoOn(60, 100, 0);
  l.pianoOff(60, 1);
  l.press(3, { trimEnd: false });
  expect(l.length).toBe(3);
});

test('loopEnd treats a chord as one onset when working out the step', () => {
  const ev = [
    { type: 'drum', t: 0 }, { type: 'drum', t: 0.01 }, // flam
    { type: 'drum', t: 0.5 }, { type: 'drum', t: 1 },
  ];
  expect(loopEnd(ev)).toBeCloseTo(1.5);
});

test('an overdub starts on its first note and ends by itself one loop later', () => {
  const l = createLooper();
  l.press(0);
  l.pianoOn(60, 100, 0);
  l.press(4); // held: 4 s loop from 4
  l.pianoOff(60, 4.1);
  l.press(5); // overdub armed at 5 ...
  expect(l.info(6).overdubWaiting).toBe(true);
  l.pianoOn(67, 100, 7); // ... the layer starts here, offset 3
  l.pianoOff(67, 7.5);
  l.pianoOn(72, 100, 10.5); // held past the end of the pass (7 + 4 = 11)
  l.schedule(11.02, 0.1, () => {});
  expect(l.state).toBe('playing');
  const held = l.events.find((e) => e.midi === 72);
  expect(held.dur).toBeCloseTo(0.5); // cut at 11, not left to ring into the next pass
  l.pianoOff(72, 12); // the late key-up changes nothing
  expect(held.dur).toBeCloseTo(0.5);
  l.pianoOn(74, 100, 12.5); // playing now, so not recorded
  expect(l.events.some((e) => e.midi === 74)).toBe(false);
});

test('pressing during the overdub still ends it early', () => {
  const l = createLooper();
  l.press(0);
  l.pianoOn(60, 100, 0);
  l.press(4);
  l.press(5);
  l.pianoOn(67, 100, 5.5);
  l.press(6);
  expect(l.state).toBe('playing');
  expect(l.events.find((e) => e.midi === 67).dur).toBeCloseTo(0.5);
});

test('with one-pass off, an overdub keeps layering until pressed', () => {
  const l = createLooper();
  l.press(0);
  l.pianoOn(60, 100, 0);
  l.press(4);
  l.press(5, { onePass: false });
  l.pianoOn(67, 100, 5);
  l.schedule(20, 0.1, () => {});
  expect(l.state).toBe('overdub');
});
