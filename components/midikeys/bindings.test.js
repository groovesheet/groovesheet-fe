import { actionFor, DEFAULT_BINDINGS, pressFromMessage, sanitizeBindings, describeBinding } from './bindings';
import { DEFAULT_PAD_MAP, PAD_ROWS, PAD_PAGES, padRowsFor, pageNote, voiceForNote, DRUM_VOICES, createDrumSynth } from './drumKit';

test('the Launchkey Play button (MIDI Start) is the loop button, Stop stops', () => {
  expect(actionFor(DEFAULT_BINDINGS, pressFromMessage([0xfa]))).toBe('loop');
  expect(actionFor(DEFAULT_BINDINGS, pressFromMessage([0xfc]))).toBe('stop');
});

test('Record and Loop (CC 117 / 118 on channel 16) also work the looper, on press only', () => {
  expect(actionFor(DEFAULT_BINDINGS, pressFromMessage([0xbf, 117, 127]))).toBe('loop');
  expect(actionFor(DEFAULT_BINDINGS, pressFromMessage([0xbf, 118, 127]))).toBe('loop');
  expect(pressFromMessage([0xbf, 117, 0])).toBeNull(); // the release
});

test('keys, sustain and MIDI clock are never mistaken for buttons', () => {
  expect(actionFor(DEFAULT_BINDINGS, pressFromMessage([0x90, 60, 100]))).toBeNull();
  expect(pressFromMessage([0xb0, 64, 127])).toBeNull();
  expect(pressFromMessage([0xb0, 1, 127], { strict: true })).toBeNull(); // mod wheel at the top
  expect(pressFromMessage([0xe0, 0, 127])).toBeNull(); // pitch wheel
  expect(pressFromMessage([0xf8])).toBeNull();
});

test('learning ignores a knob turned part way', () => {
  expect(pressFromMessage([0xbf, 21, 70], { strict: true })).toBeNull();
  expect(pressFromMessage([0xbf, 75, 127], { strict: true })).toEqual({ kind: 'cc', channel: 15, cc: 75 });
});

test('saved bindings that are malformed fall back to the defaults', () => {
  const out = sanitizeBindings({ loop: [{ kind: 'cc', cc: 'x' }], stop: [{ kind: 'note', channel: 9, note: 51 }] });
  expect(out.loop).toEqual(DEFAULT_BINDINGS.loop);
  expect(out.stop).toEqual([{ kind: 'note', channel: 9, note: 51 }]);
  expect(describeBinding(out.stop[0])).toBe('D#3 · ch 10');
});

test('each of the 16 pads starts on its General MIDI drum', () => {
  expect(PAD_ROWS.flat()).toHaveLength(16);
  expect(DEFAULT_PAD_MAP[36]).toBe('kick');
  expect(DEFAULT_PAD_MAP[38]).toBe('snare');
  expect(DEFAULT_PAD_MAP[42]).toBe('hatClosed');
  expect(DEFAULT_PAD_MAP[49]).toBe('crash');
  const page1 = PAD_ROWS.flat().map((n) => DEFAULT_PAD_MAP[n]);
  expect(new Set(page1).size).toBe(16); // no two pads share a sound
});

test('the pads flip through three pages of the GM percussion map, 16 notes apart', () => {
  expect(PAD_PAGES).toHaveLength(3);
  expect(padRowsFor(0)).toEqual(PAD_ROWS);
  expect(padRowsFor(1)[1].slice(0, 4)).toEqual([52, 53, 54, 55]);
  expect(pageNote(36, 1)).toBe(52);
  expect(pageNote(36, 2)).toBe(68);
  expect(pageNote(120, 2)).toBe(127); // never past the top of MIDI
  const all = PAD_PAGES.flatMap((_, p) => padRowsFor(p).flat());
  expect(all).toHaveLength(48);
  expect(new Set(all.map((n) => DEFAULT_PAD_MAP[n])).size).toBe(48); // 48 different drums
  expect(DEFAULT_PAD_MAP[60]).toBe('bongoHigh');
  expect(DEFAULT_PAD_MAP[81]).toBe('triangleOpen');
});

test('every drum voice synthesises without throwing', () => {
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect() {}, start() {}, stop() {}, gain: param(), frequency: param(), Q: param() });
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    createBuffer: (ch, n) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: node,
    createGain: node,
    createOscillator: node,
    createBiquadFilter: node,
  };
  const play = createDrumSynth(ctx);
  DRUM_VOICES.forEach((v) => expect(() => play(v.id, 0, 100, node())).not.toThrow());
  expect(new Set(DRUM_VOICES.map((v) => v.gm)).size).toBe(DRUM_VOICES.length); // one voice per GM note
});

test('a reassigned pad plays its new voice; other drum notes fall back to GM', () => {
  const map = { ...DEFAULT_PAD_MAP, 36: 'kick808' };
  expect(voiceForNote(map, 36)).toBe('kick808');
  expect(voiceForNote(map, 56)).toBe('cowbell');
  expect(voiceForNote(map, 100)).toBeNull();
  expect(DRUM_VOICES.every((v) => typeof v.gm === 'number')).toBe(true);
});

test('the Track buttons step the sound, and the knob page starts unassigned', () => {
  expect(actionFor(DEFAULT_BINDINGS, pressFromMessage([0xbf, 103, 127]))).toBe('prevSound');
  expect(actionFor(DEFAULT_BINDINGS, pressFromMessage([0xbf, 102, 127]))).toBe('nextSound');
  expect(describeBinding(DEFAULT_BINDINGS.nextSound[0])).toBe('Track ►');
  expect(DEFAULT_BINDINGS.knobPage).toEqual([]);
  expect(DEFAULT_BINDINGS.drumPage).toEqual([]);
  expect(sanitizeBindings({}).drumPage).toEqual([]);
  expect(sanitizeBindings({ knobPage: [] }).knobPage).toEqual([]);
  expect(sanitizeBindings({ loop: [] }).loop).toEqual(DEFAULT_BINDINGS.loop); // the loop button can't be lost
});

test('the floor tom sits 2 dB under the rest of the kit', () => {
  expect(DRUM_VOICES.find((v) => v.id === 'tom1').trimDb).toBe(-2);
  expect(DRUM_VOICES.filter((v) => v.trimDb).map((v) => v.id)).toEqual(['tom1']);
});
