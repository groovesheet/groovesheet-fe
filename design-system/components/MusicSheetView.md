# MusicSheetView

**Source of truth:** `src/components/visualization/MusicSheetView.js`
**Visual reference:** —
**Status:** documented

Renders MusicXML output as engraved sheet music using OSMD (OpenSheetMusicDisplay). Default tab in `VisualizationPanel`. Responds to `zoom` prop.

## Anatomy

```
<div.music-sheet-view>
  {loading && <spinner / message>}
  {error && <error message>}
  <div ref={containerRef} />     ← OSMD renders into this container
```

## Variants & states

- `loading`
- `error` ("Sheet music is not available for this instrument type." when no MusicXML key, or generic fetch error)
- Rendered — OSMD instance attached to container

`zoom` prop drives OSMD's zoom; XML is cached in `xmlDataRef` so zoom changes re-render without re-fetching.

## Props (read from source)

| Name | Type | Required | Purpose |
|------|------|----------|---------|
| `jobId` | string | yes | Backend workflow ID |
| `selectedInstrument` | string | yes | Used to look up MusicXML file key |
| `getToken` | function | yes | Auth token getter |
| `zoom` | number | yes | OSMD zoom multiplier (1.0–3.0 in 0.2 increments) |

## Backend integration

```js
const MUSICXML_KEY_MAP = {
  drums:     'midi2score_drums_musicxml',
  piano:     'midi2score_piano_musicxml',
  bass:      'midi2score_bass_musicxml',
  jazz_bass: 'midi2score_jazz_bass_musicxml',
};
```

Uses `downloadWorkflowFile(...)`. The `midi2score_*_musicxml` convention reflects the orchestrator's `output_key_mapping` — see `CLAUDE.md` for the full file-key list.

## Tokens used

`var(--color-panel1)`, `var(--color-foreground)`. Sheet music itself uses OSMD's default ink color (override carefully if you want dark/light theme parity).

## Tone & copy rules

- Error copy: sentence case, technical, instrument-aware

## Do / Don't

- **Do** keep `MUSICXML_KEY_MAP` in sync with backend's orchestrator output keys.
- **Do** cache `xmlData` in a ref so zoom changes are cheap.
- **Don't** re-instantiate OSMD on every render — initialize once and feed it new data.
- **Don't** assume MusicXML exists for every instrument; gate on the key map.

## Drift from generated spec

No preview reference. Engraved sheet rendering is FE-original (OSMD is a third-party lib).
