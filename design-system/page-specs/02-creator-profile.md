# Spec 02 — Public Creator Profile (`/u/:username`)

> Content spec only — Claude design owns the look. See `00-SHARED-CONTEXT.md`.

A shareable, public page (MuseScore-style) showing a user's published transcriptions and creator
identity. SEPARATE from the private account settings (`/account/profile`, spec 05), which is
where the owner edits the details shown here. When a user views their OWN profile, add a light
"this is your public profile" affordance + an "Edit profile" link to `/account/profile`;
otherwise content is identical to what visitors see.

## What the page contains

**Profile header**
- Avatar (fallback when none), display name, @username.
- Bio (short).
- Member since; external links (website, YouTube, Instagram, …).
- Stats: published count · total plays · total downloads · followers.
- Visitor actions: **Follow**, **Share**. Owner action: **Edit profile** (→ `/account/profile`).

**Toolbar**
- "Published" + count.
- Search this creator's songs by title.
- Sort: Newest · Most played · Most downloaded.
- Optional instrument filter (drums/piano/bass/vocals).

**Published songs grid** — each card: cover, title, instrument badges, duration, stats
(plays · downloads); links to `/explore/:songId`. Visitors see only `public` songs; owner may
also see unlisted with a marker.

## States
- Loading.
- Populated (visitor).
- Owner viewing own profile (Edit affordance).
- Empty (no published songs) — friendly state; if owner, CTA "Publish from your library →"
  (`/account/history`).
- Search no results.
- Unknown username — not-found state.

## Data
`CreatorProfile` + `SongCard` (00). ⚠ New: `GET /api/users/:username/profile` (public) returning
profile + published_songs; `POST/DELETE` follow. Owner detection via an `is_owner` flag from the
API (or username match against `useUser()`).
