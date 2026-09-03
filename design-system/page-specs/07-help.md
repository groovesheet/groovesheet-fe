# Spec 07 — Help & Contact (`/help`)

> Content spec only — Claude design owns the look. See `00-SHARED-CONTEXT.md`.

The help page. Nav + footer link here (currently a dead `#help` anchor). Combines **contact
channels** (WhatsApp, WeChat, Email) with an **expanded, searchable FAQ**. No separate
`/contact` page — this is it.

## What the page contains

1. **Header** — "Help & Support" + subhead ("Search the FAQ, or reach us directly — we usually
   reply within a day.").

2. **FAQ search** — filters FAQ questions live across all categories. Sits high (most users
   self-serve).

3. **Contact channels** — three:
   - **WhatsApp** — click-to-chat link (`https://wa.me/<number>`) + optional QR.
   - **WeChat** — **QR code** only, no ID (make the QR first-class — primary path for CN /
     Bilibili audience). Asset: `public/images/wechat-qr.png`.
   - **Email** — support address, `mailto:`.
   No response-time notes on the cards — the subhead already covers it.

4. **FAQ** — expanded + categorized:
   - **Getting started** (sign up/sign in, splitting a track) — from `faq.sections.overview`.
   - **Account** (profile, connected accounts, delete account).
   - **Billing & minutes** — from `faq.sections.packs` (minute meaning, deduction, expiry, failed
     jobs, adding minutes, refunds, changing/cancelling a plan).
   - **Uploads & formats** (file size limits, supported audio, output formats).
   - **Transcription quality** — from `faq.sections.features` (improving notation, live
     recordings, odd meters/tempo, output format).
   - **Publishing & Explore** (NEW — how to publish, visibility public/unlisted/private, who can
     download, unpublish, creator profile).
   Search filters across all; "no results — contact us" fallback. Category headings only — no
   pill nav and no per-category blurbs.

## States
- Default.
- Search active (filtered, with category labels on hits).
- Search no results (→ contact channels).
- Loading.

## Data
Contact details are live in `CONTACT` in `src/components/HelpSupport.js`: WhatsApp
`+65 8996 8765` (`wa.me/6589968765`, shared with Volumet), email `support@groovesheet.net`
(forwards to `edward.zhang@kelin.studio`), WeChat QR asset. FAQ extends i18n `faq.*` in `{en,zh-CN,zh-TW}/common.json`; add `account`, `uploads`,
`publishing` groups. ⚠ Optional later: a contact form to a support inbox — not required for
launch given direct channels.
