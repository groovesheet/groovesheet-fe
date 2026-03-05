# Design: Download Buttons for Stem WAV, MIDI, and BD Audio

**Issue**: #3 - GrooveSheet frontend download outputs
**Date**: 2026-03-05

## Problem

The success states in Hero.js, MidiConverter.js, and StemSplitter.js have placeholder "Stem" and "MIDI" buttons with no-op click handlers. BD audio download is completely missing.

## Current State

Each component's success state has:
- A primary download button (works) - downloads the main output
- "Stem" button - placeholder (`onClick={() => {}}`)
- "MIDI" button - placeholder (`onClick={() => {}}`)

TranscriptionHistory/TranscriptionCard already has working download buttons but always shows all 3 regardless of availability.

## Design

### Download functions per component

Each component already has `downloadInstrumentFile(id)` or similar. We'll add two more:
- `downloadStemFile(id)` - downloads the separated stem WAV
- `downloadMidiFile(id)` - downloads the MIDI file
- `downloadBdAudioFile(id)` - downloads BD audio (drums-specific)

### Backend endpoint mapping

All downloads use: `GET /workflow/download/{workflowId}/{fileKey}`

| Button | fileKey | Extension | When shown |
|--------|---------|-----------|------------|
| Stem | `{instrument}` (e.g. drums, vocals) | .wav | Always (stem separation runs for all workflows) |
| MIDI | `transcription` or `midi` (depends on instrument) | .mid | When instrument has transcription output |
| BD Audio | `bd_audio` | .wav | Drums instrument only |

### File availability handling

On success state mount, attempt downloads with error handling:
- If a download endpoint returns 404, hide that button
- Track availability in state: `{ stemAvailable, midiAvailable, bdAudioAvailable }`
- Use a lightweight check (catch 404 on download attempt) rather than pre-flight HEAD requests

### Components modified

1. **Hero.js** - Wire Stem/MIDI/BD buttons, add download handlers, add availability state
2. **MidiConverter.js** - Wire Stem/MIDI buttons, add download handlers, add availability state
3. **StemSplitter.js** - Wire Stem button (already main output), show/hide MIDI button based on availability

## Implementation Plan

1. Create branch `fix/issue-3-download-outputs`
2. Add download helper functions to each component
3. Wire up placeholder buttons to actual download logic
4. Add BD audio button for drums workflows
5. Add graceful hiding for unavailable files
6. Verify build
7. Commit referencing issue #3
