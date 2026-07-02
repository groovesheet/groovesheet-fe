# Spec 09 — API product page (`/api`)

> Content spec only — Claude design owns the look. See `00-SHARED-CONTEXT.md`.

Footer links here (currently dead `#api`). For launch this is a **product/overview page** (what
the API does, how it works, how to get access) — NOT a full interactive reference. Full docs come
later.

## What the page contains

1. **Hero** — "GrooveSheet API" + subhead ("Transcribe audio to MIDI, MusicXML, and stems
   programmatically."). Primary **Request API access** + secondary **Read the docs** (may point
   to a coming-soon placeholder).

2. **What you can do** — separate stems · transcribe (drums/piano/bass) · convert MIDI → score ·
   async job + webhook flow. Short copy each.

3. **How it works** — numbered flow: `POST` a job (audio URL + options) → poll or receive
   **webhook** on completion → download result assets. Conceptual mirror of the real pipeline.

4. **Quickstart code** — one illustrative request/response with a Copy action, e.g.:
   ```bash
   curl -X POST https://api.groovesheet.net/v1/jobs \
     -H "Authorization: Bearer $GROOVESHEET_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{ "audio_url": "https://…/track.mp3", "workflow": "drums" }'
   ```
   ```json
   { "job_id": "job_…", "status": "queued" }
   ```
   Mark endpoints as illustrative placeholders.

5. **Pricing / limits** — short: API metered in the same **minutes** currency; note rate limits /
   queue tiers; link `/pricing`. Don't rebuild pricing cards.

6. **Access** — closing: "Building with GrooveSheet?" → **Request access** (→ `/help` or a
   waitlist), since self-serve keys may not exist yet.

## States
- Default.
- Code block Copy → copied confirmation.
- If access is gated: a "Coming soon / request access" treatment on the CTAs (early state likely
  waitlist — make this easy to toggle).

## Data
Static/marketing content. ⚠ New later: real API endpoints, key issuance, docs site. For launch,
"Request access" → `/help` contact channels or a simple email/waitlist.
