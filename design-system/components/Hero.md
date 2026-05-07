# Hero

**Source of truth:** `src/components/Hero.js` (+ `Hero.css`, ~21k of CSS — large)
**Visual reference:** `preview/component-upload.html`, `preview/component-progress.html`
**Status:** documented

The marketing-page hero **and** the central upload/transcribe interaction. Same component handles the idle marketing copy, drag-and-drop upload, instrument selection, polling cold start, progress simulation, success confetti, and post-transcription `VisualizationPanel` mount.

## Anatomy

```
<section.hero>
  <div.hero-content>
    <h1>Get Scores in Seconds - Not Weeks.
    <p>Built for speed and accuracy so you can focus on practice, teaching, and performance.
    <UploadCard>     ← glass-morph dashed-border drop zone, the brand's signature interaction
      <state: idle>           TrayArrowUpIcon + "Drag in an MP3 or browse" + Browse Files button
      <state: uploading>      file metadata + cancel
      <state: cold_starting>  ServerIcon + "Warming up the engine" + indefinite progress
      <state: processing>     MagicWandIcon + simulated 99% bar (20 steps over 60s, exponential)
      <state: success>        CheckCircleIcon + confetti + download CTAs + VisualizationPanel
    <Disclaimer>     "By uploading a file, you agree to our Terms of Service and Privacy Policy."
  ; conditionally below the card after success:
  <VisualizationPanel>  ← embeds tabs (PianoRollView / MusicSheetView / MidiEditorView) + DownloadSection
```

## Variants & states

State machine (`useState` driven): `idle → uploading → cold_starting → processing → success`. Each state swaps icon + headline + subline + footer chrome. Drag-over swaps dashed border to solid `var(--color-primary)`.

Instruments selectable via dropdown: drums, piano, jazz_bass, bass, vocals, other. Icon mapping: `LuDrum`, `Piano` (lucide), `LuGuitar`, `LiaMicrophoneAltSolid`, `LuMusic4`.

Backend routing per instrument:
- drums → `/api/workflow/separate_to_drumscore_full`
- piano → `/api/workflow/separate_to_piano_score_full`
- jazz_bass → `/api/workflow/separate_to_jazz_bass_score_full`
- bass → `/api/workflow/separate_to_bass_score_full`
- default (other / vocals) → `/api/workflow/demucs_separate`

Upload limits enforced client-side: `MAX_FILE_SIZE_BYTES = 32 * 1024 * 1024`. MIME + extension allowlist (mp3, wav, flac, ogg, au, sph). Polling tolerates 8 consecutive 404s for cold start; backoff 3s → 20s.

## Props

Hero takes auth and login-flow context internally — top-level component, no required props from parent (renders inside the route shell).

## Tokens used

Hero.css is the largest CSS file in the project (~600 lines). Heavy `var(--color-*)` usage including `--color-primary`, `--color-panel1`, `--color-panel2`, `--color-border-light`, `--color-border-lighter`, `--color-surface-light`. Plus `backdrop-filter: blur(20px) saturate(180%)` on the upload card glass. Container max-width 1414px (matches Header/Footer).

## Tone & copy rules

- Hero headline: **"Get Scores in Seconds - Not Weeks."** (Title Case, en dash without surrounding spaces in this exact case — keep verbatim if reusing)
- Subline: **"Built for speed and accuracy so you can focus on practice, teaching, and performance."**
- Drop zone main copy: Title Case ("Drag in an MP3 (or choose one)")
- Disclaimer: light weight, sentence case, links underlined
- Browse Files button: "Browse Files" — exact copy, Title Case

## Do / Don't

- **Do** keep the glass morphism (`backdrop-filter: blur(20px) saturate(180%)`) on the upload card — this is the *only* place glass is used in the system.
- **Do** route new instruments by adding to the instrument list AND a backend endpoint mapping in the same change.
- **Do** mirror the state-machine pattern (`idle → uploading → cold_starting → processing → success`) for any new long-running upload flow.
- **Do** trigger `confetti` from `canvas-confetti` on success — it's the system's only celebratory animation.
- **Don't** add glass morphism to other cards. Pricing, Features, FAQ, etc. are opaque.
- **Don't** change `MAX_FILE_SIZE_BYTES` without coordinating with backend — Hero, MidiConverter, StemSplitter, and TranscriptionHistory all share this limit and download key conventions (see comment in Hero.js around line 47).

## Drift from generated spec

`preview/component-upload.html` shows the upload card alone with simple state transitions. Real Hero subsumes the entire homepage hero section (headline, subline, disclaimer, post-success VisualizationPanel mount). When scaffolding new upload UIs (StemSplitter, MidiConverter), follow Hero's state machine, not the standalone preview. The preview is good for static visual reference of the dashed-glass drop zone only.
