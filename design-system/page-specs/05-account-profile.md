# Spec 05 — Account / Profile settings (`/account/profile`)

> Content spec only — Claude design owns the look. See `00-SHARED-CONTEXT.md`.

The **private account & profile settings** page. Owner-only. SEPARATE from the public creator
profile (`/u/:username`, spec 02). Its job: edit identity, manage the **public creator-profile
details** the world sees on `/u/:username`, set preferences, handle security. It does NOT
duplicate billing (04) or the song library (03) — it shows a compact **read-only** plan/credits
snapshot linking out to billing.

## What the page contains

**Profile header** — avatar, display name, email, plan badge, member since. A **"View public
profile →"** link to `/u/{username}`. An **Edit profile** affordance.

**Public creator profile** (these fields feed `/u/:username`) — editable:
- **Username** (the `/u/:username` handle; availability check; warn that changing it changes the
  URL).
- Display name, avatar, bio, external links (website, YouTube, Instagram… add/remove).
- Save / Cancel. Helper: "Shown publicly on your creator page."

**Account details** — first name, last name (may differ from the public display name).

**Plan & credits snapshot** — READ-ONLY: tier name, minutes remaining, next-recharge date, and
a single **"Manage in Billing →"** link (`/account/billing`). No top-ups, plan cards, payment
method, or usage table here.

**Connected accounts** — Google / Apple / Facebook (from `user.external_accounts`): provider +
connected/not-connected; connect/disconnect where applicable.

**Preferences** — Theme (Dark/Light, wired to ThemeContext), Language (i18n).

**Security / danger zone** — Change email (or "managed by {provider}" for OAuth-only users),
Sign out, **Delete account** (destructive, requires confirmation).

## States
- Loading.
- Default (read mode).
- Edit mode (public-profile + account-details; Save disabled until changed).
- Username taken / available inline validation.
- OAuth-only user (email change disabled, shown as provider-managed).
- Provider connected vs not connected.
- Delete-account confirm (destructive, typed confirmation).

## Data (real — `src/auth.js`, `src/utils/api.js`)
`useUser()` (id, email, first/last name, name, image_url, external_accounts, user_metadata);
`fetchAccountSummary` for the read-only snapshot. ⚠ New: public-profile fields (username,
display_name, bio, links, avatar) via `GET/PATCH /api/account/settings` (route exists, unused in
FE), username availability check, delete-account.
