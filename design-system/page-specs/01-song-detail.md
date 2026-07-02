# Spec 01 — Song Detail page (`/explore/:songId`)

> Content spec only — Claude design owns the look. See `00-SHARED-CONTEXT.md` for the publish
> model and data shapes.

The centerpiece of the publishing layer. Every published transcription has one. It renders in
**two modes from the same component**: a **public view** and an **owner view** (= public view +
an edit/publish control layer, shown only when `song.owner.user_id === currentUser.id`). A basic
version exists today and needs a full content rework.

## What the page contains

**Song header**
- Cover/thumbnail (fallback when none).
- Song **title**.
- **Creator credit** — "transcribed by {owner.display_name}" linking to `/u/{owner.username}`,
  with the owner's avatar. This is the primary attribution.
- **Original artist** — secondary credit ("Original: {original_artist}"). Must be clearly
  distinguished from the creator (transcriber). Two different people/entities.
- Meta: instrument badges (drums/piano/bass/vocals), genre tags, duration.
- Stats: plays · downloads · likes.
- Public actions: **Like**, **Download** (opens downloads).
- Visibility indicator if unlisted/private.

**Score / preview viewer**
- Embedded score render (MusicXML) with play/pause + seek over `preview_audio_url`.
- Instrument/part selector when multiple instruments.

**Downloads** — free for everyone on published songs: MusicXML (score), MIDI, and each separated
stem. One action per asset.

**Description** — owner's notes (`description`). Hidden in public view if empty.

**Creator card** — compact owner block: avatar, display name, "View profile →"
(`/u/:username`), published count.

### Owner-only control layer (when current user owns the song)
- "You own this transcription" indication + helper text.
- **Edit** — title, original artist, instrument/genre tags, description, cover image, and the
  creator-credit display name.
- **Publish control** — Publish when unpublished; when published, a **visibility** selector
  (Public / Unlisted / Private) + Unpublish. Publishing `public` puts it on `/explore` and makes
  downloads free to all.
- Save / Cancel for edits.

## States
- Loading.
- Public view (not owner) — no edit controls; downloads free.
- Owner, unpublished (Draft) — prominent Publish action.
- Owner, published — visibility selector + Unpublish.
- Owner editing — editable fields with Save/Cancel.
- Private/unlisted visited by non-owner without access — "this transcription is private" state.
- Publish confirm — explains "anyone can view and download MusicXML, MIDI, and stems for free,
  and it appears on Explore."

## Data
`Song` shape (00). ⚠ New: `GET /api/songs/:id`, `PATCH /api/songs/:id` (owner edits),
`POST /api/songs/:id/publish` (+visibility), like/download counters. Ownership decided client-side
via `song.owner.user_id === useUser().user.id`.
