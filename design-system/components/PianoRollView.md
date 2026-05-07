# PianoRollView

**Source of truth:** `src/components/visualization/PianoRollView.js`
**Visual reference:** —
**Status:** documented

Canvas-based piano-roll renderer for the generated MIDI. Uses `@tonejs/midi` to parse, then draws notes onto a `<canvas>` with a black/white piano-key column on the left.

## Anatomy

```
<div ref={containerRef}>
  <canvas ref={canvasRef} />     ← scrollable piano-roll grid
  ; left-column piano keys + note rectangles drawn imperatively
```

## Variants & states

- `loading` while fetching MIDI blob
- `error` if no MIDI for instrument or fetch fails
- Rendered — canvas with notes positioned by pitch (y) and time (x)

Color palette (constant in source) — green family per note, alternating shades for octave bands:
```js
const NOTE_COLORS = ['#00e676', '#00c853', '#69f0ae', '#00e676', '#00bfa5', ...]
```

Range: MIDI notes 21 (A0) to 108 (C8) — the standard 88-key piano.

## Props (read from source)

| Name | Type | Required | Purpose |
|------|------|----------|---------|
| `jobId` | string | yes | Backend workflow ID |
| `selectedInstrument` | string | yes | Used to look up MIDI file key |
| `getToken` | function | yes | Auth token getter |
| `zoom` | number | yes | Horizontal scale (timeline) |

## Backend integration

Same `MIDI_KEY_MAP` as `MidiEditorView` (verify duplication is intentional — these maps **must** stay in sync).

## Tokens used

Mostly hard-coded canvas colors (greens above, plus piano key blacks/whites). `var(--color-panel1)`, `var(--color-border)`, `var(--color-foreground)` for chrome around the canvas. Hard-coded green palette is intentional for note-on visibility — don't replace with theme tokens.

## Tone & copy rules

N/A — canvas-only visual.

## Do / Don't

- **Do** treat the green note palette as part of the brand — it's the only place green appears in the system.
- **Do** clip the visible MIDI range to A0–C8.
- **Don't** add zoom modifications to vertical (pitch) axis — only horizontal (time) zooms.
- **Don't** convert canvas drawing to SVG/HTML — performance matters for dense MIDI.

## Drift from generated spec

No preview reference. Piano-roll rendering is FE-original.
