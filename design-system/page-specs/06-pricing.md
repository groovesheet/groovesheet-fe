# Spec 06 — Pricing page (`/pricing`)

> Content spec only — Claude design owns the look. See `00-SHARED-CONTEXT.md`.

Dedicated pricing page. The nav already links `/pricing` (currently 404s — this fixes it).
**Reuse the existing home pricing cards** (`<Pricing>`) as the centerpiece — don't redesign the
cards — and surround them with conversion content.

## What the page contains

1. **Header** — "Pricing" + one-line value prop ("Simple minute-based pricing. 1 minute of audio
   = 1 minute of credit. Start free.").

2. **Pricing cards** — embed the existing `<Pricing>` component: Plans tab (Free / Lite / Pro) +
   Top-Ups tab (Starter / Plus / Power), monthly/annual toggle with the "3 Months Free" annual
   badge. Data from `fetchBillingPlans()`.

3. **Feature comparison table** — Free vs Lite vs Pro. Rows: minutes/month, upload size per file,
   download formats (PDF/MusicXML/MIDI), batch processing, queue priority (standard/priority/
   fast), support level, early access. Mark Lite as most popular.

4. **Social proof** — reuse `<Testimonials>` + a small trust row (Stripe-secure checkout, all
   formats included, supported instruments: drums/piano/bass/vocals).

5. **Billing FAQ** — reuse `<FAQ>`, billing-focused (from i18n `faq.sections.packs`): what a
   minute means, how minutes are deducted, expiry, what happens if a job fails, adding minutes,
   refunds (link `/refund-policy`), changing/cancelling a plan (→ Stripe portal).

6. **Final CTA** — "Start transcribing free" (→ upload / sign-up) + secondary "Talk to us"
   (→ `/help`).

## States
- Monthly (default) and annual toggle.
- Top-Ups tab selected.
- Loading (component shows fallback values while `fetchBillingPlans` resolves).
- Signed-in (Buy/Upgrade) vs signed-out (Get started) CTA differences.

## Data (real)
`fetchBillingPlans('/api')` → `{ plans[], topups[] }`; checkout via `createCheckoutSession(plan)`
(`tier2`,`tier2_annual`,`tier3`,`tier3_annual`,`topup-30/60/120`).
