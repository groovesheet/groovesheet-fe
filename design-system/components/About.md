# About

**Source of truth:** `src/components/About.js` (+ `About.css`)
**Visual reference:** —
**Status:** documented

The `/about` page. Marketing content + a contact form posted to HubSpot Forms API.

## Anatomy

```
<page>
  <Header onLoginClick={...} />
  <main>
    [About story sections — read source for current copy]
    <form>
      name input
      email input
      message textarea
      consent checkbox
      submit button     ← sends to HubSpot endpoint via fetch
    [success / error states]
  <Footer />
```

## Variants & states

- Form: idle / submitting / `submitStatus === 'success'` / `submitStatus === 'error'`
- Consent checkbox required before submission (alerts otherwise)

## Props

| Name | Type | Required | Purpose |
|------|------|----------|---------|
| `onLoginClick` | function | no | Forwarded to Header |

## Integration

HubSpot Forms API. Reads `REACT_APP_HUBSPOT_PORTAL_ID` and `REACT_APP_HUBSPOT_FORM_GUID` env vars. Posts to HubSpot's submission endpoint (read source for current URL pattern).

## Tokens used

`var(--color-panel1)`, `var(--color-panel2)`, `var(--color-foreground)`, `var(--color-muted-foreground)`, `var(--color-border)`, `var(--color-primary)`.

## Tone & copy rules

- Form labels: sentence case
- Success/error copy: sentence case
- Page narrative: working-musician casual (matches `VISUAL_GUIDE.md`)

## Do / Don't

- **Do** keep HubSpot credentials in env vars (`REACT_APP_HUBSPOT_*`). Never hard-code.
- **Do** alert / inline-validate before submission rather than letting HubSpot reject.
- **Don't** add fields without coordinating with HubSpot form definition.
- **Don't** post to a public endpoint without the env-var portal/form IDs — graceful no-op if missing.

## Drift from generated spec

No specific preview. Form-field patterns appear in `preview/component-form-field.html` and `preview/component-inputs.html` — they describe the *primitive* style; About's form composition is FE-original.
