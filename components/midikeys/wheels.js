/**
 * Pitch wheel decoding for /midi-keyboard.
 *
 * A pitch-bend message (En lsb msb) carries a 14-bit value, 0..16383, with
 * 8192 at rest. It maps to -1..1 so the bend range (semitones) can be applied
 * separately; the two halves are scaled on their own so both ends reach +-1.
 */
export function bendAmount(lsb, msb) {
  const v = (msb << 7) | lsb;
  return v >= 8192 ? (v - 8192) / 8191 : (v - 8192) / 8192;
}
