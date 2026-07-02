# Backend gaps — Account, Billing & Library pages

Derived from the Claude Code designs implemented in:

- [`src/components/AccountProfile.js`](../src/components/AccountProfile.js) — `/account/profile`
- [`src/components/AccountBilling.js`](../src/components/AccountBilling.js) — `/account/billing`
- [`src/components/TranscriptionHistory.js`](../src/components/TranscriptionHistory.js) — `/account/history` ("Your Library")

The frontend is wired against `src/utils/api.js`. Where a design feature needs
data the backend does not expose yet, the FE calls the endpoint **best-effort**:
on success it works; on failure it degrades (section hidden, optimistic update,
or a "not available yet" toast). Nothing throws an uncaught error.

This file is the punch list for the backend (`groovesheet-be/api-orchestrator`)
to make every feature real.

**Legend** — ✅ exists & used · ⚠️ NEW (must build) · 🔸 partial / needs fields

---

## 1. Already exists (reused — no work)

| Endpoint | Method | Used by |
|---|---|---|
| `/user/account` | GET | Billing + Profile summary (`fetchAccountSummary`) |
| `/user/transactions?limit&offset` | GET | Billing usage table (`fetchAccountUsageHistory`) |
| `/account/settings` | GET | (available; not yet surfaced) |
| `/billing/plans` | GET | Billing plan + top-up cards (`fetchBillingPlans`) |
| `/user/subscription` | GET | available (`fetchUserSubscription`) |
| `/billing/create-checkout-session` | POST | Plan / top-up checkout (`createCheckoutSession`) |
| `/billing/create-portal-session` | POST | Manage / update payment (`createBillingPortalSession`) |
| `/workflow/list` | GET | Library list (`fetchWorkflowList`) |
| `/workflow/{id}` (status) | GET | Library item detail (`fetchWorkflowStatus`) |
| `/workflow/download/{id}/{file_key}` | GET | Library downloads |

---

## 2. ⚠️ Account & Profile — missing endpoints

The public **creator profile** is an entirely new concept (username, display
name, bio, external links, avatar). No table or routes exist today.

| Endpoint | Method | FE helper | Request | Response |
|---|---|---|---|---|
| `/account/profile` | GET | `fetchCreatorProfile` | — | `{ username, display_name, bio, avatar_url, links:[{platform,url}], member_since }` |
| `/account/profile` | PUT | `updateCreatorProfile` | `{ username?, display_name?, bio?, links? }` | updated profile |
| `/account/profile/username-available?username=` | GET | `checkUsernameAvailability` | — | `{ available: boolean }` |
| `/account/profile/avatar` | POST (multipart) | `uploadAvatar` | `file` | `{ avatar_url }` |
| `/user/account` | **PATCH** | `updateAccountName` | `{ first_name, last_name }` | updated account |
| `/account/email` | POST | `updateUserEmail` | `{ email }` | `{ status }` (sends confirm email) |
| `/account` | DELETE | `deleteAccount` | — | `204` / `{ status }` |

### Backend work
- **DB:** new `creator_profiles` table (or columns on the user mirror):
  `user_id (FK, unique)`, `username (unique, citext, slug-validated)`, `display_name`,
  `bio (<=160)`, `avatar_url`, `links jsonb`, `created_at`. `member_since` = user row `created_at`.
- **Username rules:** `^[a-z0-9_]{3,20}$`, globally unique, reserved-word list. The
  availability route must be cheap (indexed unique lookup).
- **Avatar:** upload to R2 (`groovesheet-audio` or a public bucket), return CDN URL.
  Validate mime/size; strip EXIF.
- **`PATCH /user/account`:** today `/user/account` is GET-only. Add name update;
  if Supabase is the source of truth for names, mirror via `auth.admin.updateUserById`.
- **Email change:** prefer routing through the server so the BE mirror stays in
  sync. Supabase `updateUser({ email })` triggers a confirm email; the server route
  should wrap that (and reject when the user is a pure social login).
- **Delete account:** cascade — cancel Stripe subscription, delete workflows + R2
  objects, profile, credit ledger, then the auth user. Irreversible; require the
  confirm-word check (FE already enforces typing the username).

### Connected accounts (OAuth link/unlink) — ⚠️ no endpoint
The "Connect / Disconnect" buttons for Google / Apple / Facebook currently only
toast. Linking/unlinking identities needs Supabase `linkIdentity` /
`unlinkIdentity` flows (client) plus a server confirmation, or dedicated routes.
Connection **status** is already read from `useUser().external_accounts`.

---

## 3. ⚠️ Billing & Usage — missing / partial

| Endpoint | Method | FE helper | Status | Notes |
|---|---|---|---|---|
| `/billing/payment-method` | GET | `fetchPaymentMethod` | ⚠️ NEW | `{ brand, last4, exp }` of the default card. Read from Stripe `PaymentMethod`. Section is hidden until this returns data. |
| `/billing/create-checkout-session` | POST | `createCheckoutSession` | 🔸 | See checkout-code mismatch below. |

### Checkout code vs plan id mismatch (🔸 needs aligning)
- `/billing/plans` returns plan ids like `lite_monthly` / `pro_annual` and topup ids.
- `/billing/create-checkout-session` expects `tier2 | tier2_annual | tier3 |
  tier3_annual | topup-30 | topup-60 | topup-120`.
- FE bridges this with a hardcoded `CHECKOUT_CODE` map in `AccountBilling.js`.
  **Fix:** either have `/billing/plans` include the exact `checkout_id` per
  plan/topup, or make the checkout endpoint accept the same ids as `/billing/plans`.
  Then delete the FE map.

### Allowance / ring
The minutes ring needs the plan's monthly allowance. FE reads
`minutes_per_month` from `/billing/plans` for the user's tier. Ensure the tier id
from `/user/account.subscription.tier` shares a family prefix with `/billing/plans`
ids (`lite_*` / `pro_*`) so they can be matched. Confirm `subscription` also
returns `is_active` and `next_recharge_at` (used for the status pill + caption).

---

## 4. ⚠️ Library (Your Library) — publish / edit / delete

The redesign turns the history list into a full library with **publish state,
visibility, edit, and delete** per transcription.

| Endpoint | Method | FE helper | Request | Response |
|---|---|---|---|---|
| `/workflow/{id}/visibility` | POST | `updateWorkflowVisibility` | `{ visibility: 'public'\|'unlisted'\|'private' }` | updated item |
| `/workflow/{id}` | PATCH | `updateWorkflowMetadata` | `{ title?, original_artist?, genre_tags?, description? }` | updated item |
| `/workflow/{id}` | DELETE | `deleteWorkflow` | — | `204` / `{ status }` |

> "Edit details" currently toasts (handler is wired to `updateWorkflowMetadata`
> but the edit modal/form is not built — add it once the endpoint exists).
> Visibility changes apply optimistically and silently revert if the endpoint 404s.

### Fields the Library UI wants on the workflow status payload (🔸)
`GET /workflow/{id}` should also return, when available:

| Field | Used for | Fallback today |
|---|---|---|
| `visibility` (`public`/`unlisted`/`private`) | status badge + publish menu | defaults to `private` |
| `title` | card title (editable, distinct from filename) | filename via `resolveDisplayName` |
| `metadata.duration_seconds` | duration pill / Length column | hidden |
| `cover_url` | card thumbnail | instrument-colored placeholder |
| `stats: { plays, downloads }` | published-card stats row | not shown |
| `published_at` | sort / "published" grouping | — |

### Backend work
- **DB:** add `visibility` (enum, default `private`), `published_at`, optional
  `cover_url`, `title`, `original_artist`, `genre_tags`, `description`, and a
  `stats` source (plays/downloads counters) to the workflow/transcription record.
- **Publish semantics** (per shared spec): publishing a song exposes the online
  viewer + **free** downloads (MusicXML, MIDI, stems) to everyone, and lists it on
  `/explore`. Enforce visibility on the download + detail routes.

---

## 5. ⚠️ Public surfaces referenced by links (out of scope here)

These pages link out to public surfaces that also need new endpoints (separate
work — the three implemented pages link to them but do not render them):

- `/u/{username}` — public creator profile → `GET /creators/{username}` (profile + published songs)
- `/explore/{id}` / `/song/{id}` — public song detail → `GET /songs/{id}` (ownership-gated, public assets)
- `/explore` published feed — `GET /explore?...` of public songs

---

## Summary — new endpoints to build

```
GET    /account/profile
PUT    /account/profile
GET    /account/profile/username-available
POST   /account/profile/avatar          (multipart)
PATCH  /user/account                     (name update; GET exists)
POST   /account/email
DELETE /account
GET    /billing/payment-method
POST   /workflow/{id}/visibility
PATCH  /workflow/{id}                     (metadata edit)
DELETE /workflow/{id}
# plus: OAuth link/unlink, checkout-id unification, public creator/song/explore routes
```
