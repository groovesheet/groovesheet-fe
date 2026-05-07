# BusinessInformation

**Source of truth:** `src/components/BusinessInformation.js` (uses shared `LegalPage.css`)
**Visual reference:** —
**Status:** documented

The `/business-information` page. Linked from the Footer's copyright. Lists the legal entity, registration, address, phone, email.

## Anatomy

Implements the **LegalPage shared layout** — see [`LegalPage.md`](LegalPage.md) for the full pattern. Specific content:

```
<h1>Business Information
<div.legal-section>
  <p>GrooveSheet is operated by USEFOOL TECHNOLOGY PRIVATE LIMITED (Hong Kong).
  <p>Hong Kong Business Registration No.: 77709205 (Established 2025)
  <p>Registered Address: Unit 2A, 17/F, Glenealy Tower, No.1 Glenealy, Central, Hong Kong S.A.R.
  <p>Phone: +65 8575 5666
  <p>Email: business@usefool-ai.com
```

## Props

| Name | Type | Required | Purpose |
|------|------|----------|---------|
| `onLoginClick` | function | no | Forwarded to Header |

## Tone & copy rules

- Plain paragraph style (not numbered sections, unlike PrivacyPolicy / RefundPolicy / TermsConditions)
- Each fact on its own line — entity, registration, address, phone, email

## Do / Don't

- **Do** keep the entity name **USEFOOL TECHNOLOGY PRIVATE LIMITED** in ALL CAPS — it's how the company is registered.
- **Do** verify the registration number / address with legal before any change.
- **Don't** abbreviate the address. The full Glenealy Tower address is the registered legal address.
- **Don't** add a contact form here — About is the contact-form page.

## Drift from generated spec

Not in any preview. Pure legal content page; design follows the LegalPage shared layout described above.
