# LoginModal

**Source of truth:** `src/components/LoginModal.js` (+ `LoginModal.css`)
**Visual reference:** `preview/component-modal.html`
**Status:** documented

Multi-step authentication modal. Opens from any "Log in" CTA. Wraps Clerk via the local `'../auth'` module.

## Anatomy

```
<portal to body>
  <div.modal-overlay>     ← dark overlay, click-to-close
    <div.modal>
      <button.close-btn>X
      ; one of three views, controlled by showEmailSignIn / showVerification:
      • PROVIDER LIST (default):
          [Google] [Facebook] [Apple] [Email]   ← provider buttons with corner-photo backgrounds
      • EMAIL ENTRY (showEmailSignIn=true):
          <button.back> ← Back
          <input.email>
          [Continue]
      • CODE VERIFICATION (showVerification=true):
          <button.back> ← Back
          <span>Code sent to {email}</span>
          6× <input.code-input> auto-advance
          [Verify] [Resend]
```

## Variants & states

| State | When |
|---|---|
| Provider list | Initial open |
| Email entry | After clicking the Email button |
| Verification | After submitting email — Clerk sends 6-digit code via `email_code` strategy |
| Sign-up fallback | If sign-in returns 422 / `form_identifier_not_found`, switches to `signUp.create({ emailAddress })` then verifies same way |

OAuth providers redirect to `/sso-callback` (then `/`).

## Props (read from source)

| Name | Type | Required | Purpose |
|------|------|----------|---------|
| `isOpen` | boolean | yes | Mount gate; returns `null` when false |
| `onClose` | function | yes | Called by close button + overlay click |

## Tokens used

`var(--color-overlay-dark)`, `var(--color-panel1)`, `var(--color-foreground)`, `var(--color-border)`, `var(--color-primary)`, `var(--color-button-light)`. Modal overlay uses the deliberately-maxed `z-index: 2147483647` pattern.

## Tone & copy rules

- Provider button labels: "Continue with Google", "Continue with Facebook", "Continue with Apple", "Continue with Email" — Title Case
- Inline errors: sentence case, technical ("Please enter your email address")
- Verification copy: "Code sent to {email}" — sentence case

## Do / Don't

- **Do** keep the modal portal-rendered with the dark overlay; matches the only modal in the system.
- **Do** swallow auth errors visibly (alerts or inline text). Never silently fail.
- **Do** default the verify view to focus `code-input-0` after a 0ms timeout (lets React commit first).
- **Don't** add new auth strategies without wiring through `'../auth'` (the wrapper exports `useSignIn`, `useSignUp`, `useClerk`).
- **Don't** lock body scroll via `document.body.style` directly; check existing utilities first.

## Drift from generated spec

`preview/component-modal.html` shows a generic modal with a header / body / footer split; LoginModal is purpose-built and doesn't use a generic Modal primitive. **FE wins** — when adding any new modal, mirror this portal + overlay + close-button + click-outside pattern from LoginModal rather than the preview's stack. There is no shared `<Modal>` primitive yet (gap candidate in `_index.md`).
