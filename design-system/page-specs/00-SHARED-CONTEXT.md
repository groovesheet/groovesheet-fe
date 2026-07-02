# GrooveSheet — Shared context for all page specs

> **These are CONTENT specs, not design specs.** GrooveSheet's design system, components, and
> visual aesthetic are already owned by Claude design — trust it. Each file says WHAT goes on a
> page (sections, content, data, behavior), not how it should look. Read this file first; it's
> the single source of truth for routes, the publishing model, and data shapes.

## Product

GrooveSheet is an AI music-transcription SaaS. A user uploads audio → it's separated into stems
and transcribed to MIDI / MusicXML / score. We are adding a **publishing + community layer**
(like MuseScore): a user can publish a transcription to the public `/explore` feed, where anyone
can view and download it. Each transcription has a **song detail page**; each user has a
**public creator profile** of their published works, plus **private account pages** (library,
billing, settings).

## Routes

| Route | Page | Audience | Spec |
|---|---|---|---|
| `/explore` | Public feed of published songs (exists) | everyone | — |
| `/explore/:songId` | Song detail — public view + owner view (ownership-gated) | everyone / owner | 01 |
| `/u/:username` | Public creator profile (published works) | everyone | 02 |
| `/account/history` | Private library — ALL transcriptions (incl. processing, unpublished) | owner | 03 |
| `/account/billing` | Billing & usage | owner | 04 |
| `/account/profile` | Private settings — identity, prefs, security, edits public profile | owner | 05 |
| `/pricing` | Pricing page | everyone | 06 |
| `/help` | Help & contact + searchable FAQ | everyone | 07 |
| `*` | 404 Not Found | everyone | 08 |
| `/api` | API product page | everyone | 09 |
| `/changelog` | Changelog / release notes | everyone | 10 |
| `/service-status` | Service status (exists; redesign) | everyone | 11 |

**Footer/nav cleanup (do alongside launch pages):** wire `Pricing → /pricing`, `Help → /help`,
`API → /api`, `Changelog → /changelog`, add `Service Status → /service-status`. Remove/hide the
Desktop/iOS/Android app placeholder links until those products exist. (Spec 01 originally said
`/song/:id`; keep the live `/explore/:songId` instead.)

## Ownership & publish model

- A viewer is the **owner** of a song if `song.owner.user_id === currentUser.id`. Owner view =
  public view **plus** an edit/publish control layer. ONE page/component, ownership-gated.
- **Visibility:** `public` (on /explore) · `unlisted` (link-only) · `private` (owner only).
- **Publishing exposes view + FREE downloads to everyone:** online viewer + free download of
  MusicXML, MIDI, and separated stems. No paywall on published assets.
- **Owner can edit:** title & metadata (original artist credit, instrument/genre tags,
  description), publish state & visibility (+ cover), and creator credit (how they're attributed
  as transcriber, link to their `/u/:username`).
- "Creator/owner" = the person who ran the transcription and published it — NOT the original
  recording artist. Both are shown and clearly distinguished on the song detail page.

## Data shapes (assumed; ⚠ = new backend endpoint required)

```js
Song = {                            // ⚠ new public endpoints for published songs
  id, title,                        // title editable by owner
  original_artist,                  // editable credit — artist of the ORIGINAL track
  instruments: ['drums'|'piano'|'bass'|'vocals', ...],
  genre_tags: [string], description,
  cover_url, duration_seconds, created_at, published_at | null,
  visibility: 'public'|'unlisted'|'private',
  owner: { user_id, username, display_name, avatar_url },   // the transcriber
  stats: { plays, downloads, likes },
  assets: { preview_audio_url, score_musicxml_url, midi_url, stems: [{ instrument, url }] },
}

CreatorProfile = {                  // ⚠ new
  username, display_name, avatar_url, bio, member_since,
  links: { website, youtube, instagram, ... },
  stats: { published_count, total_plays, total_downloads, followers },
  published_songs: [SongCard],
}
```

## Existing data sources (real — `src/utils/api.js`, `src/auth.js`)

- `useUser()` → `{ user: { id, email, first_name, last_name, name, image_url,
  external_accounts:[{provider}], user_metadata, identities }, isLoaded, isSignedIn }`
- `useAuth()` → `{ isLoaded, isSignedIn, getToken(), sessionId }`
- `fetchAccountSummary(...)` → `{ subscription: { tier, balance_minutes, balance_seconds,
  is_active, next_recharge_at, subscription_id, customer_id } }`
- `fetchAccountUsageHistory(..., {limit,offset}, ...)` → `{ transactions:[{ id, amount_minutes,
  description, transaction_type, created_at, workflow_id, balance_after }], total }`
- `fetchBillingPlans(baseUrl)` → `{ plans:[...], topups:[...] }`
- `createCheckoutSession(...)`, `createBillingPortalSession(...)` → Stripe URLs
- Transcription jobs (TranscriptionHistory) → grouped by year/status, download per asset:
  instrument stem, MusicXML, MIDI, score.

## Reusable existing components to compose with

`<Pricing>` (Plans/Top-Ups tabs + monthly/annual toggle), `<FAQ>` (accordion), `<Testimonials>`,
`<Button>`, the search bar from TranscriptionHistory. Reference them by name; let Claude design
handle the look.
