/**
 * 88-key piano geometry, shared by the renderer and pointer hit-testing.
 *
 * Matches the keyboard drawn at the foot of the /video2forpiano piano roll
 * (see components/video/VideoPianoRoll.js `drawKeyboard`): MIDI 21..108,
 * 52 white keys, black keys 60% as wide and 62% as tall, straddling the
 * boundary between their neighbouring whites.
 */

export const MIN_PITCH = 21; // A0
export const MAX_PITCH = 108; // C8
export const WHITE_KEY_COUNT = 52;

const BLACK_PITCH_CLASSES = [1, 3, 6, 8, 10];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const isBlackKey = (midi) => BLACK_PITCH_CLASSES.includes(midi % 12);

export const noteName = (midi) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

/**
 * Build the key rectangles for a keyboard of `width` x `height` pixels.
 * Returns whites and blacks separately so callers can draw whites first and
 * hit-test blacks first (they sit on top).
 *
 * @param {object} [black]  black-key proportions, relative to a white key:
 *   `widthRatio` (0.6 = the standard 60% of a white key) and `heightRatio`
 *   (0.62 of the keyboard height). Exposed so a projected keyboard can be
 *   matched to the real instrument it is being cast onto.
 */
export function buildKeyLayout(width, height, black = {}) {
  const { widthRatio = 0.6, heightRatio = 0.62 } = black;
  const whiteWidth = width / WHITE_KEY_COUNT;
  const blackWidth = whiteWidth * widthRatio;
  const whites = [];
  const blacks = [];

  let whiteIdx = 0;
  for (let midi = MIN_PITCH; midi <= MAX_PITCH; midi += 1) {
    if (isBlackKey(midi)) {
      // Straddles the seam between the previous white key and the next one,
      // staying centred on it whatever width the ratio gives.
      blacks.push({
        midi,
        black: true,
        x: whiteIdx * whiteWidth - blackWidth / 2,
        y: 0,
        w: blackWidth,
        h: height * heightRatio,
      });
    } else {
      whites.push({
        midi,
        black: false,
        x: whiteIdx * whiteWidth,
        y: 0,
        w: whiteWidth,
        h: height,
      });
      whiteIdx += 1;
    }
  }

  return { whites, blacks, whiteWidth };
}

/** Which key is at (x, y)? Blacks win — they overlap the whites they sit on. */
export function keyAtPoint(layout, x, y) {
  for (const k of layout.blacks) {
    if (x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h) return k.midi;
  }
  for (const k of layout.whites) {
    if (x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h) return k.midi;
  }
  return null;
}
