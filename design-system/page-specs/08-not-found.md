# Spec 08 — 404 Not Found (catch-all route)

> Content spec only — Claude design owns the look. See `00-SHARED-CONTEXT.md`.

Catch-all fallback for undefined routes (add as `<Route path="*">` in App.js). Small, on-brand,
helpful.

## What the page contains
- A clear "page not found" message (a music-flavored line is welcome, e.g. "This page hit a wrong
  note").
- Short explanation ("doesn't exist or was moved").
- Actions: **Back to home** (→ `/`) + **Explore transcriptions** (→ `/explore`). Optional "Search
  the FAQ" (→ `/help`).
- Optional small row of helpful links (Pricing, Explore, Help).

## Notes
- Single state, both themes.
- Respect the active locale prefix (`/en`, `/zh-CN`, `/zh-TW`) for home/explore links.
