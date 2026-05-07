# MidiEditorView

**Source of truth:** `src/components/visualization/MidiEditorView.js`
**Visual reference:** —
**Status:** documented

Embedded MIDI editor view. Loads the generated MIDI blob and renders it inside an `<iframe>` (likely a third-party editor, e.g. an OSS web MIDI editor — verify in source).

## Anatomy

```
<div.midi-editor-view>
  {loading && <spinner / message>}
  {error && <error message>}
  <iframe ref={iframeRef} src={midiBlobUrlRef.current} />
```

## Variants & states

- `loading` (initial)
- `error` (e.g., `'MIDI editor is not available for this instrument type.'` when the instrument has no MIDI key map entry; `'MIDI file not found...'` when the workflow output is missing)
- Loaded — iframe with blob URL

## Props (read from source)

| Name | Type | Required | Purpose |
|------|------|----------|---------|
| `jobId` | string | yes | Backend workflow ID |
| `selectedInstrument` | string | yes | Used to look up MIDI file key |
| `getToken` | function | yes | Auth token getter |

## Backend integration

```js
const MIDI_KEY_MAP = {
  drums:     'adtof_drums_midi',
  piano:     'transkun_v2_piano_midi',
  bass:      'fcpe_bass_midi',
  jazz_bass: 'bassunet_jazz_bass_midi',
};
```

Calls `downloadWorkflowFile(API_BASE_URL, jobId, fileKey, getToken)` from `src/utils/api.js`. Stores the resulting blob URL in `midiBlobUrlRef`.

## Tokens used

`var(--color-panel1)`, `var(--color-foreground)`, `var(--color-border)`.

## Tone & copy rules

- Error copy: sentence case, technical ("MIDI editor is not available for this instrument type.", "MIDI file not found. It may not have been generated yet.")

## Do / Don't

- **Do** keep `MIDI_KEY_MAP` in sync with `PianoRollView` (same map duplicated by design — source comment near other instances flags multi-file shared download conventions; if you change one, change the other).
- **Do** `URL.revokeObjectURL` on cleanup (verify component unmount path).
- **Don't** re-fetch on every render — the `useEffect` cancellation pattern guards against stale state.

## Drift from generated spec

No preview reference. Embedded iframe editor pattern is FE-original.
