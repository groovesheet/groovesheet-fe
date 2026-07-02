# Spec 11 — Service Status (`/service-status`)

> Content spec only — Claude design owns the look. See `00-SHARED-CONTEXT.md`.

Exists already but is unlinked and off-system. Goal: a clean, trustworthy status board showing
pipeline health, plus a footer link to it. Convey status with **text + icon**, not color alone.

## What the page contains

1. **Overall banner** — headline state: "All systems operational" / "Some systems degraded" /
   "Major outage" / "Maintenance", with a last-checked timestamp.

2. **Components list** — one row per subsystem with a current status:
   - API / Orchestrator
   - Audio separation (Demucs)
   - Drum transcription (ADTOF)
   - Bass transcription (BassUNet)
   - Piano transcription (Transkun)
   - Score conversion (MIDI → MusicXML)
   - Uploads / storage (R2)
   - Auth & accounts
   Each: name, status, optional one-line note, optional 90-day uptime indicator.

3. **Queue / processing health** (optional) — current queue depth / average job time, so users
   can tell "slow" from "down".

4. **Incident history** — reverse-chronological recent incidents/maintenance: date, affected
   component, status (resolved/monitoring), short note. Empty: "No incidents in the last 90 days."

5. **Footer note** — "Having trouble? Contact us" → `/help`.

## States
- All operational.
- Degraded (one component).
- Outage (component down + active incident).
- Maintenance.
- Loading.

## Data
⚠ Source up to you: a status JSON endpoint, a manually-updated static config, or real per-service
health polling. Shape: `{ overall, updated_at, components:[{ name, status, note?, uptime_90d? }],
incidents:[{ date, component, status, note }] }`.
