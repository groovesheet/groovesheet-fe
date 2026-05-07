# Pricing

**Source of truth:** `src/components/Pricing.js` (+ `Pricing.css`)
**Visual reference:** `preview/component-card.html`
**Status:** documented

The marketing pricing block. Tabs between **Plans** and **Top-Ups**, billing toggle Monthly / Annually, three plan cards (Free / Lite / Pro) with the middle card highlighted as the popular plan.

## Anatomy

```
<section.pricing>
  <div.pricing-container>
    <div.pricing-header-section>
      <h2>Affordable Plans For Everyone.
      <p>Try it free today...
      <div.pricing-tabs> [Plans] [Top-Ups] + sliding indicator
    <div.pricing-toggle-wrapper>           ← only when activeTab === 'plans'
      <div.pricing-toggle> [Monthly] [Annually • 3 Months Free]
    <div.pricing-cards>
      <div.pricing-card>                   ← Free
        <header> name + HOBBYIST badge + price + outline CTA "Get Free"
        <body>   "For individuals" + 4 feature items with check SVGs
      <div.pricing-card.featured>          ← Lite (highlighted)
        <div.popular-badge> MOST POPULAR
        <div.pricing-card-inner>           ← inner panel — creates the "frame" look
          <header> name + PROFESSIONAL badge + price + primary CTA "Subscribe"
          <body>   "Best for small teams" + features
      <div.pricing-card>                   ← Pro
        <header> name + ENTERPRISE badge + price + outline CTA
        <body>   "Designed for companies" + features
```

## Variants & states

| State | Effect |
|---|---|
| `activeTab === 'plans'` (default) | Shows billing toggle + plan cards |
| `activeTab === 'topups'` | Shows top-up packs (read source for current copy) |
| `billingMode === 'monthly'` | Plan price = monthly value |
| `billingMode === 'annual'` (default) | Plan price = annualized value (Lite: $7.5 vs $10) |
| `loading === <plan>` | CTA reads "Processing..." and is `disabled` |
| Not signed in | Clicking a plan CTA calls `onLoginClick` instead of POSTing |

The featured card uses **a 12px-thick blue picture frame** (16px outer / 13px inner radius pairing) — the most distinctive border treatment in the system.

## Props (read from source)

| Name | Type | Required | Purpose |
|------|------|----------|---------|
| `onLoginClick` | function | no | Called when an unauthenticated user clicks a plan CTA — opens `LoginModal` |

## API integration

Authenticated POST to `/api/user/assign-plan` with `{ plan }` body via `authenticatedFetch(..., getToken)`. Always passes `getToken` from `useAuth()` — matches the rule in `CLAUDE.md`.

## Tokens used

`var(--color-primary)`, `var(--color-panel1)`, `var(--color-panel2)`, `var(--color-foreground)`, `var(--color-muted-foreground)`, `var(--color-border)`. Card radii are layered: outer 16px, inner 13px, smaller items 12 / 8 / 6 / 4px.

## Tone & copy rules

- Section title: **"Affordable Plans For Everyone."** (Title Case, ends with period — intentional)
- Subtitle in sentence case
- Plan names: **Title Case** ("Free", "Lite", "Pro")
- Plan badges: **ALL CAPS** ("HOBBYIST", "PROFESSIONAL", "ENTERPRISE", "MOST POPULAR") — the only place ALL CAPS is allowed in the system
- Plan subtitles: sentence case ("For individuals", "Best for small teams", "Designed for companies")
- Feature items: digits + units ("10 minutes / month", "100 MB upload/file", "Standard queue")
- CTA text: Title Case verbs ("Get Free", "Subscribe", "Get Pro")

## Do / Don't

- **Do** preserve the outer/inner card radius pair (16px / 13px) on the featured card — it's the picture-frame look.
- **Do** keep ALL CAPS limited to plan badges and "MOST POPULAR".
- **Do** use `authenticatedFetch(..., getToken)` for any new plan/billing API call.
- **Don't** swap the inline check SVGs for icon-library imports. They're sized exactly to the design (14×16 / 15×16 px).
- **Don't** add gradients to plan cards — the only gradient in the system is the upload progress bar (`linear-gradient(90deg, #012FA7, #0139C7)`).

## Drift from generated spec

`preview/component-card.html` shows generic cards. Real Pricing card has a unique "popular plan = blue picture frame" treatment that the preview doesn't capture. **FE wins** — when scaffolding similar tier-based selection UI, copy the inner-wrapper pattern (`pricing-card-inner` inside `pricing-card.featured`) rather than relying on the preview.
