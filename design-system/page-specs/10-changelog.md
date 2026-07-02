# Spec 10 — Changelog (`/changelog`)

> Content spec only — Claude design owns the look. See `00-SHARED-CONTEXT.md`.

Footer links here (currently dead `#changelog`). Reverse-chronological list of product updates —
signals the product is actively maintained.

## What the page contains

1. **Header** — "Changelog" + subhead ("What's new in GrooveSheet.") + optional "Subscribe for
   updates" (→ email / `/help`).

2. **Entries** — reverse chronological. Each: date; optional version tag (e.g. `v1.2`);
   type label(s) **New / Improved / Fixed**; a one-line title; a short bullet list of changes;
   optional image/gif for visual features.

3. **Load more / pagination** at the bottom when the list grows.

## States
- Populated (mix New/Improved/Fixed).
- Loading.
- Empty ("No updates yet").

## Data
⚠ Simplest is a static markdown/JSON source (`src/content/changelog.json` or `.md`), rendered
client-side; no backend needed for launch. Entry: `{ date, version?, tags:['new'|'improved'|
'fixed'], title, body[], image? }`.
