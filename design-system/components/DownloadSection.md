# DownloadSection

**Source of truth:** `src/components/visualization/DownloadSection.js` (no separate CSS — uses parent `VisualizationPanel.css`)
**Visual reference:** —
**Status:** documented

The success header inside `VisualizationPanel`. Big check icon, "Transcription Succeeded!" title, filename row, and 1–3 download buttons (transcription primary; stem + MIDI secondary).

## Anatomy

```
<div.viz-download-section>
  <button.viz-close-btn>           ← X icon, calls onReset
  <div.viz-download-header>
    <CheckCircle size=64 weight=fill color=white />
    <h2>Transcription Succeeded!
    <div.viz-filename> <File icon /> {fileName}
  <div.viz-download-buttons>
    <button.viz-download-primary>   ← Transcription + DownloadSimple weight=bold
    <div.viz-download-row>
      <button.viz-download-secondary> {stemLabel}    ← always rendered
      <button.viz-download-secondary> MIDI            ← only when isTranscriptionInstrument
  {downloadError && <p.viz-download-error>{downloadError}</p>}
```

`stemLabelMap` derives the label from instrument key (e.g., `drums → 'Drums Stem'`, `jazz_bass → 'Bass Stem'`, `vocals → 'Vocals Stem'`).

## Variants & states

| State | Effect |
|---|---|
| `isTranscriptionInstrument` (drums / piano / jazz_bass / bass) | Renders MIDI button alongside stem |
| Stems-only (vocals / other / bass_separation) | Renders only stem button — no MIDI |
| `downloadError` truthy | Renders error paragraph |

## Props (read from source)

| Name | Type | Required | Purpose |
|------|------|----------|---------|
| `fileName` | string | yes | Original uploaded filename, displayed under title |
| `selectedInstrument` | string | yes | Drives stem label + MIDI gating |
| `onDownloadTranscription` | function | yes | Primary CTA |
| `onDownloadStem` | function | yes | Secondary CTA |
| `onDownloadMidi` | function | yes | Secondary CTA (only rendered when applicable) |
| `onReset` | function | yes | Close button handler |
| `downloadError` | string | no | Inline error text |

## Tokens used

`var(--color-panel1)`, `var(--color-foreground)`, `var(--color-muted-foreground)`, `var(--color-primary)` (primary download), plus inline `color="white"` and `color="#8d8c8d"` (matches `--color-muted-foreground` dark — track in token gaps).

## Tone & copy rules

- Title: **"Transcription Succeeded!"** — Title Case + the only exclamation mark in the success flow (mirrors Features card "Export!" spirit)
- Stem labels: **Title Case** ("Drums Stem", "Bass Stem", "Vocals Stem", "Other Stem", "Stem" fallback)
- Primary button: just **"Transcription"** (verb omitted, icon implies)
- Secondary buttons: just **"MIDI"**, **"{Instrument} Stem"**

## Do / Don't

- **Do** extend `stemLabelMap` when adding new instrument types. Don't fall back to the generic "Stem" if a specific label fits.
- **Do** keep `CheckCircle` at `size={64} weight="fill"` — it's the "celebration" moment for the user.
- **Don't** add another exclamation mark elsewhere in the result flow. One per surface.

## Drift from generated spec

No standalone preview. The "success card with three downloads" pattern is FE-original; closest preview reference would be `component-card.html` for outer chrome.
