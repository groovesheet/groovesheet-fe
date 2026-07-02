# Spec 03 — Transcription History / Private Library (`/account/history`)

> Content spec only — Claude design owns the look. See `00-SHARED-CONTEXT.md`.

The owner's **private library** — lists **ALL** their transcriptions, including ones still
processing and ones never published. It's the launch point for publishing: from here the owner
opens a song detail page (`/explore/:songId`) or publishes inline. Owner-only. It's the private
counterpart to the public creator profile (02): the profile shows only published songs to the
world; this shows everything to the owner, with publish state visible and editable. Redesign of
the existing page — keep its DNA (search, processing section, completed items grouped by year,
per-asset downloads) and add publish state.

## What the page contains

**Toolbar**
- Search by filename/title.
- Filter by status (All · Processing · Ready · Published · Draft) and instrument.
- Sort (Newest · Oldest · Most played).
- Optional grid/list view toggle.

**Processing section** (if any in-flight) — progress (%) + status, filename. Downloads/publish
disabled until ready.

**Library** — completed transcriptions, **grouped by year**. Each item:
- Cover thumbnail, title + filename (extension split as today), date/time, instruments, duration.
- **Publish-state badge:** Draft · Published · Unlisted · Private (the key new element).
- Stats for published items: plays · downloads.
- Primary action: **Open** → `/explore/:songId` (owner view).
- Quick actions: **Publish / Unpublish**, **Edit details**, **Downloads** (MusicXML / MIDI /
  stems — keep existing per-asset downloads), **Delete**.
- **Inline publish:** confirm popover (visibility selector + "free downloads for everyone on
  Explore" note) without leaving the page.

**File-retention notice** (keep): "We store your files for 1 year, after which they're
automatically deleted."

## States
- Loading.
- Processing + ready mix.
- All ready, mixed publish states.
- Empty library — CTA "Transcribe your first song →" (upload).
- Search/filter no results.
- Inline publish confirm.
- Delete confirm (destructive).

## Data
Real transcription-jobs source (current `TranscriptionHistory.js`) for list, grouping, processing
progress, per-asset download URLs. ⚠ New: each item needs `visibility` / `published_at` / `stats`
+ a publish mutation (`POST /api/songs/:id/publish`). Map each job to a `Song` (00).
