# MidiConverter

**Source of truth:** `src/components/MidiConverter.js` (shares `Hero.css`)
**Visual reference:** `preview/component-upload.html`
**Status:** documented

The `/midi-converter` page. Upload-and-convert flow specifically for MIDI generation. Architecturally a sibling of `Hero` and `StemSplitter` — same upload state machine, same instrument selection, different backend endpoints + page chrome.

## Anatomy

```
<page>
  <Header />
  <main>
    <Hero-style upload card>     ← state machine: idle → uploading → cold_starting → processing → success
      [Instrument selector]
      [TrayArrowUpIcon | drag/drop zone]
      [Browse Files] | [Cancel]
    <Features />                 ← reused marketing block
    <Pricing />                  ← reused marketing block
    <FAQ />                      ← reused marketing block
  <Footer />
```

The page reuses **the same upload state machine** as `Hero.js`, but is its own top-level page component (renders Header / Footer / marketing sections together).

## Variants & states

Same `idle → uploading → cold_starting → processing → success` machine as Hero. `confetti` fires on success. Polling tolerates 8 consecutive 404s. Notification permission requested via `requestNotificationPermission`.

## Props

None — page component.

## API integration

Uses `previewFetch`, `startPreview`, `upgradeToFull`, `setPendingPreviewId` from `src/utils/previewApi.js` (note: separate from the main `api.js` because of the preview-then-upgrade flow). Also `authenticatedFetch`, `downloadWorkflowFile` from `api.js`.

## Tokens used

Inherits from `Hero.css` (heavy use of `var(--color-*)` chrome variables). No `MidiConverter.css` file — styles live in shared `Hero.css`.

## Tone & copy rules

- Match Hero's tone for the upload card (Title Case CTAs, sentence case body)
- Page title in Title Case ("MIDI Converter")
- Instrument labels: lowercase keys (`drums`, `piano`, `bass`, etc.), capitalized for display

## Do / Don't

- **Do** keep the upload state machine in sync with Hero, StemSplitter, and TranscriptionHistory's download conventions. The note at line 50 in source flags this explicitly: *"Download key maps (stemKeyMap, midiKeyMap) and download handlers are shared across Hero.js, MidiConverter.js, StemSplitter.js, and TranscriptionHistory.js. When changing download logic here, update those files too."*
- **Do** reuse `Features`, `Pricing`, `FAQ` marketing blocks below the fold. Don't fork them.
- **Do** request notification permission before kickoff so cold-start completion can ping the OS.
- **Don't** create a separate `MidiConverter.css`. Styles share `Hero.css` deliberately.
- **Don't** add new SVG icon components inline if Hero / StemSplitter already define them. Extract to a shared module if reuse grows.

## Drift from generated spec

The generated bundle's `src/components/Hero.js` is the standalone upload card. Real FE has *three* nearly-identical upload pages (Hero, MidiConverter, StemSplitter) plus a shared download-key convention. **FE wins** — the right pattern for new "upload + processing" pages is to copy MidiConverter / StemSplitter shape, not the preview.
