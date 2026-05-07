# VisualizationPanel

**Source of truth:** `src/components/visualization/VisualizationPanel.js` (+ `VisualizationPanel.css`)
**Visual reference:** —
**Status:** documented

The post-success result viewer mounted by Hero / MidiConverter / StemSplitter once a workflow finishes. Composes `DownloadSection` + (`VisualizationTabs` + active view) into a single panel.

## Anatomy

```
<div.viz-panel ref={panelRef}>
  <DownloadSection ... />     ← always rendered
  {isTranscriptionInstrument && (
    <div.viz-viewer-section>
      <VisualizationTabs ... />
      <div.viz-viewer-content>
        {activeTab === 'sheet'}    → <MusicSheetView />     (default)
        {activeTab === 'pianoroll'} → <PianoRollView />
        {activeTab === 'editor'}    → <MidiEditorView />
```

`isTranscriptionInstrument = ['drums', 'piano', 'jazz_bass', 'bass'].includes(selectedInstrument)`. Stems-only flows (vocals / other) skip the viewer section and only show `DownloadSection`.

## Variants & states

- `activeTab`: `'sheet' | 'pianoroll' | 'editor'` — defaults to `'sheet'`
- `zoom`: `1.0` default, increments by `0.2` up to `3.0` via `handleZoomIn`
- Fullscreen: `panelRef.current.requestFullscreen()` toggle

## Props (read from source)

| Name | Type | Required | Purpose |
|------|------|----------|---------|
| `jobId` | string | yes | Backend workflow ID for fetching outputs |
| `selectedInstrument` | string | yes | Drives viewer availability + key maps |
| `fileName` | string | yes | Forwarded to `DownloadSection` for header |
| `getToken` | function | yes | Clerk-style token getter from `useAuth()` |
| `onDownloadTranscription` | function | yes | Forwarded to DownloadSection |
| `onDownloadStem` | function | yes | Forwarded to DownloadSection |
| `onDownloadMidi` | function | yes | Forwarded to DownloadSection |
| `onReset` | function | yes | "Close" handler — returns user to upload state |
| `downloadError` | string | no | Forwarded to DownloadSection |

## Tokens used

`var(--color-panel1)`, `var(--color-panel2)`, `var(--color-foreground)`, `var(--color-muted-foreground)`, `var(--color-border)`, `var(--color-primary)`. Theme toggle wired through `useTheme()`.

## Tone & copy rules

No copy directly — composes children. Verify child specs for voice.

## Do / Don't

- **Do** keep the conditional viewer-section gating on `isTranscriptionInstrument`. Stems-only outputs don't have a sheet/piano-roll/editor.
- **Do** mount `MusicSheetView` as default tab. Sheet music is the most "this is the result" experience.
- **Don't** add new tabs without also extending the `TABS` constant in `VisualizationTabs.js` and the conditional render block here.
- **Don't** lift `zoom` / `activeTab` state to the parent — these are panel-local UI state.

## Drift from generated spec

No standalone preview HTML for this panel. Constituent patterns appear in `preview/component-tabs.html`, `preview/component-segmented.html`. The panel composition is FE-original.
