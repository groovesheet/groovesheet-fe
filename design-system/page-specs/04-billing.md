# Spec 04 — Billing & Usage (`/account/billing`)

> Content spec only — Claude design owns the look. See `00-SHARED-CONTEXT.md`.

The **money page**: current plan, minutes balance, buy more minutes, manage subscription /
payment method (via Stripe portal), usage history. Owner-only. Do NOT put identity/preferences/
security here (those live in `/account/profile`, spec 05) or the song library (spec 03).
GrooveSheet bills in **minutes** (1 minute of audio ≈ credits internally). Tiers: Free, Lite
(monthly/annual), Pro (monthly/annual), plus top-ups. Checkout + portal are Stripe-hosted.
Redesign of the existing page — keep the summary + usage table.

## What the page contains

**Summary** — three pieces of info:
- **Current plan** — tier name, active/inactive status, next-recharge date.
- **Minutes remaining** — the balance; optionally remaining-vs-allowance.
- **Plan actions** — Manage subscription (→ Stripe portal, paid only) + Buy more minutes (paid)
  or Upgrade plan (free tier).

**Plans / top-ups** (always for free tier; behind Upgrade/Buy-more otherwise) — reuse the
existing `<Pricing>` data/components: Lite & Pro plans with monthly/annual toggle (price, minutes/
month, max rollover, CTA → `createCheckoutSession`); top-ups (+30/+60/+120 min, price, priority-
queue note). Mark the current plan.

**Payment method** (paid) — note it's managed in Stripe; **Manage payment method** →
`createBillingPortalSession`. Don't build a card form.

**Usage history** — paginated table: Date · Description · Type · Minutes (±, spend vs grant).
Prev/Next + total count. Empty state when none.

## States
- Loading.
- Free tier (upgrade-forward; no "manage subscription").
- Paid active (manage subscription + buy more + payment method).
- Paid inactive / payment issue (recover CTA).
- Annual vs monthly toggle.
- Usage table empty / populated + pagination.
- Signed-out / auth error — redirect prompt (current behavior).

## Data (real — `src/utils/api.js`)
`fetchAccountSummary` → subscription; `fetchAccountUsageHistory({limit,offset})` →
`{ transactions[], total }`; `fetchBillingPlans` → `{ plans[], topups[] }`;
`createCheckoutSession(plan)` (`tier2`,`tier2_annual`,`tier3`,`tier3_annual`,`topup-30/60/120`);
`createBillingPortalSession()`.
