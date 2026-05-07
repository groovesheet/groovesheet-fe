# StemSplitter

**Source of truth:** `src/components/StemSplitter.js` (shares `Hero.css`)
**Visual reference:** `preview/component-upload.html`
**Status:** documented

The `/stem-splitter` page. Upload-and-separate flow for splitting an audio file into stems (drums / bass / vocals / other). Sibling to `Hero` and `MidiConverter` — same upload state machine, different output.

## Anatomy

```
<page>
  <Header />
  <main>
    <Hero-style upload card>     ← state machine: idle → uploading → cold_starting → processing → success
      [Instrument selector]      ← drums / bass / vocals / other
      [TrayArrowUpIcon | drop zone]
      [Browse Files] | [Cancel]
    <Features />                 ← reused
    <Pricing />                  ← reused
    <FAQ />                      ← reused
  <Footer />
```

## Variants & states

Identical state machine to Hero / MidiConverter. Confetti on success. Same MIME / extension / 32 MB limits.

## Props

None.

## API integration

Same shared utilities as MidiConverter: `previewFetch`, `startPreview`, `upgradeToFull`, `setPendingPreviewId`, `authenticatedFetch`. Output is stem files (e.g. `demucs_drums_stem`, `demucs_bass_stem`) — see `CLAUDE.md` for the file-key convention.

## Tokens used

Inherits from `Hero.css`.

## Tone & copy rules

- Page title in Title Case ("Stem Splitter")
- Match Hero's voice
- Instrument keys lowercase, label capitalized

## Do / Don't

- **Do** mirror Hero / MidiConverter for any change to the upload UX — the three pages are siblings, not independent.
- **Do** use `stemKeyMap` for download keys (shared with Hero's success state and TranscriptionHistory's download buttons).
- **Don't** drift the cold-start tolerance, file-size limit, or supported MIME list from the other two pages.
- **Don't** add new components for upload, drag/drop, instrument selector — extend the Hero pattern in place or extract to a shared component (and update all three call sites in the same PR).

## Drift from generated spec

Same as MidiConverter — the preview shows a single upload card; the FE composes Header + upload card + reused marketing sections + Footer into a full page. The composition is FE-original.
