/**
 * Writing to the Launchkey MK4's screen (Programmer's Reference Guide,
 * "Controlling the screen"). Three SysEx messages do it:
 *
 *   F0 00 20 29 02 <sku> 04 <target> <config> F7   configure / trigger a display
 *   F0 00 20 29 02 <sku> 06 <target> <field> <text> F7   set one text field
 *
 * <sku> is 14h for the 25/37/49/61/88 and 13h for the Minis. Targets used:
 *   21h  the global temporary display (the instrument name)
 *   15h-1Ch  each knob's own temporary display (an effect's name and value)
 * Arrangements: 1 = name + text value (2 lines), 2 = title + name + value (3).
 * A config of 7Fh shows the display with what was last written to it.
 *
 * Sending SysEx needs Web MIDI's SysEx permission; without it the page works
 * the same, just without the screen.
 */

const HEADER = [0xf0, 0x00, 0x20, 0x29, 0x02];
export const SKU_REGULAR = 0x14;
export const SKU_MINI = 0x13;
export const TARGET_GLOBAL = 0x21;
export const TARGET_KNOB_1 = 0x15;
const TRIGGER = 0x7f;
const MAX_CHARS = 18; // what fits across the 128-pixel screen

/** The screen takes printable ASCII only; anything else becomes a space. */
export function screenText(text) {
  const bytes = [];
  for (const ch of String(text).slice(0, MAX_CHARS)) {
    const c = ch.charCodeAt(0);
    bytes.push(c >= 0x20 && c <= 0x7e ? c : 0x20);
  }
  return bytes;
}

export const configureMsg = (sku, target, arrangement) => [...HEADER, sku, 0x04, target, arrangement & 0x1f, 0xf7];
export const triggerMsg = (sku, target) => [...HEADER, sku, 0x04, target, TRIGGER, 0xf7];
export const textMsg = (sku, target, field, text) => [...HEADER, sku, 0x06, target, field, ...screenText(text), 0xf7];

/** Messages that show up to three lines on a display target. */
export function showLines(sku, target, lines) {
  const arrangement = lines.length >= 3 ? 2 : 1;
  return [
    configureMsg(sku, target, arrangement),
    ...lines.slice(0, 3).map((line, field) => textMsg(sku, target, field, line)),
    triggerMsg(sku, target),
  ];
}

/**
 * The output to write to: the Launchkey's DAW port if it has one (the screen
 * listens there), else any Launchkey port. Returns { output, sku } or null.
 */
export function findLaunchkeyOutput(outputs) {
  const all = [...outputs].filter((o) => /launchkey/i.test(o.name || ''));
  if (!all.length) return null;
  const output = all.find((o) => /daw/i.test(o.name)) || all[0];
  return { output, sku: /mini/i.test(output.name) ? SKU_MINI : SKU_REGULAR };
}
