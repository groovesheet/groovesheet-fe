# LegalPage (shared layout)

**Source of truth:** `src/components/PrivacyPolicy.js`, `src/components/RefundPolicy.js`, `src/components/TermsConditions.js`, `src/components/BusinessInformation.js` — all share `LegalPage.css`
**Visual reference:** —
**Status:** documented

Four sibling pages (`/privacy-policy`, `/refund-policy`, `/terms`, `/business-information`) all using the same chrome and typography. There is no shared component file yet — each page reimplements the structure inline. **This spec describes the shared layout pattern; the four files implement it independently.**

## Anatomy (shared)

```
<div.legal-page>
  <Header onLoginClick={...} />
  <main.legal-container>
    <section.legal-content>
      <h1.legal-title>{Page Title}
      <div.legal-body>
        <div.legal-section> × N
          <h2.legal-heading>{section heading, often numbered "1. ..."}
          <p.legal-text>{paragraph}
          [<ul.legal-list> with <li> items, when applicable]
  <Footer />
```

## The four pages

| Page | File | Title | Section style |
|---|---|---|---|
| Privacy Policy | `PrivacyPolicy.js` | "Privacy Policy" | Numbered h2 ("1. What we collect", "2. Audio & Processing Data", …) |
| Refund Policy | `RefundPolicy.js` | "Refund Policy" | Numbered h2 |
| Terms & Conditions | `TermsConditions.js` | "Terms and Conditions" (verify) | Numbered h2 |
| Business Information | `BusinessInformation.js` | "Business Information" | Plain paragraphs (entity name, registration, address, contact) |

## Props (each page)

| Name | Type | Required | Purpose |
|------|------|----------|---------|
| `onLoginClick` | function | no | Forwarded to Header |

## Tokens used

`var(--color-panel1)`, `var(--color-foreground)`, `var(--color-muted-foreground)`, `var(--color-border)`. Plus default body container max-width inherited from `LegalPage.css`.

## Tone & copy rules

- Page titles: **Title Case** ("Privacy Policy", "Refund Policy", "Business Information")
- Section headings: numbered, Title Case ("1. What we collect", "2. Audio & Processing Data")
- Body text: sentence case, third-person professional ("We collect information you provide…", "We retain data as long as needed…")
- Lists with `<ul.legal-list>` for grouped items
- Contact email: `business@usefool-ai.com`
- Entity: USEFOOL TECHNOLOGY PRIVATE LIMITED (Hong Kong)

## Do / Don't

- **Do** mirror the structure exactly when adding a new legal page (e.g., Cookie Policy). Copy `PrivacyPolicy.js` as the template.
- **Do** consider extracting a shared `<LegalPage title="...">{children}</LegalPage>` component if a 5th legal page lands — the four current files duplicate Header/Footer/main wrapping logic.
- **Don't** alter the registered legal entity name (`USEFOOL TECHNOLOGY PRIVATE LIMITED`) or business-registration details on the Business Information page without legal review.
- **Don't** mix the numbered-section style with plain-paragraph style on a single page (Privacy uses numbered; Business uses plain — pick one).

## Drift from generated spec

No preview reference. Legal page styling is FE-original — the design system intentionally has nothing to say about legal page chrome beyond "use the visual tokens."
