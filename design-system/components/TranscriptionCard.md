# TranscriptionCard

**Source of truth:** `src/components/TranscriptionCard.js` (+ `TranscriptionCard.css`)
**Visual reference:** `preview/component-list-row.html`
**Status:** documented

A history row card. Two halves: metadata header (date / time / filename split into name + extension) on the left, download buttons row on the right. Renders 1–4 download buttons depending on which callbacks are passed.

## Anatomy

```
<div.transcription-card>
  <div.card-header>
    <div.card-metadata> {date} | {time}
    <div.card-filename> <name>{name}</name> <ext>{extension}</ext>
  <div.card-downloads>
    <button.download-button>      ← rendered only when handler is passed:
      • {Instrument} Track          ← onDownloadInstrument
      • Transcription               ← onDownloadTranscription
      • MIDI                        ← onDownloadMIDI
      • Score                       ← onDownloadScore
      <ArrowDown size=28 weight=regular />
```

Filename split: `getFileNameParts(fullName)` splits on the **last** dot, so `mix.master.wav` → `name="mix.master"`, `extension=".wav"`.

## Variants & states

- 0–4 download buttons rendered based on truthiness of each `onDownload*` prop.
- Instrument label is `instrument.charAt(0).toUpperCase() + instrument.slice(1)` — e.g., `"drums"` → `"Drums"`. Pass lowercase from caller; capitalization is local.

## Props (read from source)

| Name | Type | Required | Purpose |
|------|------|----------|---------|
| `date` | string | yes | Pre-formatted display date |
| `time` | string | yes | Pre-formatted display time |
| `fileName` | string | yes | Original uploaded filename, with extension |
| `instrument` | string | no, defaults `'drums'` | Lowercase instrument key, used for label |
| `onDownloadInstrument` | function | no | Click handler; presence renders the "{Instrument} Track" button |
| `onDownloadTranscription` | function | no | Click handler for "Transcription" button |
| `onDownloadMIDI` | function | no | Click handler for "MIDI" button |
| `onDownloadScore` | function | no | Click handler for "Score" button |

## Tokens used

`var(--color-foreground)`, `var(--color-muted-foreground)`, `var(--color-border)`, `var(--color-panel1)`, `var(--color-primary)` (download buttons accent on hover).

## Tone & copy rules

- Button labels: **Title Case** ("Drums Track", "Transcription", "MIDI", "Score") — verb omitted; the icon implies download
- Aria labels include the verb: `aria-label={'Download ${instrumentLabel} track'}`, `"Download MIDI"`, `"Download Score"`
- Phosphor `ArrowDown` at `size={28} weight="regular"` (matches AccountIcon User icon size convention)

## Do / Don't

- **Do** pass formatted `date` / `time` strings — TranscriptionCard is presentational, not a date formatter.
- **Do** keep download buttons callback-driven. Renders nothing if no callbacks are supplied.
- **Do** add new download types by adding a new `onDownload*` prop and matching button. Mirror the existing button structure exactly.
- **Don't** change the filename split logic to use the first dot or a regex — `lastIndexOf('.')` is intentional for files like `mix.master.wav`.
- **Don't** lift the instrument capitalization into the parent. Parent passes lowercase, card capitalizes for display.

## Drift from generated spec

`preview/component-list-row.html` shows generic list-row chrome (chip + meta + actions). Real TranscriptionCard has a specific two-half header (metadata vs filename) and 1–4 callback-driven download buttons. **FE wins** — when scaffolding new history-row UIs, mirror the conditional-button pattern from TranscriptionCard rather than the preview's static row.
