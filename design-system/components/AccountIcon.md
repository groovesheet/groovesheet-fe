# AccountIcon

**Source of truth:** `src/components/AccountIcon.js` (+ `AccountIcon.css`)
**Visual reference:** `preview/component-avatar.html`, `preview/component-dropdown.html`
**Status:** documented

The signed-in user trigger in the header — Phosphor `User` icon + "Account" label, opens a portal dropdown menu. Has a `compact` mode for the mobile menu.

## Anatomy

**Default (desktop):**

```
<div.account-button.inline-flex>
  <button>
    <div.account-icon> <User size=28 weight=regular />
    <div.account-label> Account
  ; portal to body when open:
  <div.account-dropdown-backdrop>     ← transparent click-outside catcher, z 999
  <div.account-dropdown-menu.desktop>
    <button.account-dropdown-item> Profile
    <button.account-dropdown-item> Transcription History
    <div.account-dropdown-divider>
    <button.account-dropdown-item> Sign out
```

**Compact (in mobile menu):** strips the icon, renders a left-aligned plain "Account" label that toggles the same portal dropdown (`.account-dropdown-menu.mobile` variant).

## Variants & states

| Variant | When |
|---|---|
| Default | Desktop header (right side, beside theme toggle / language) |
| Compact (`compact={true}`) | Inside the mobile menu — looks like other mobile-nav items |

States:
- Closed (default)
- Open: dropdown rendered via portal; closes on (a) clicking an item, (b) clicking the backdrop, (c) `mousedown` outside the menu, (d) `signOut()` resolves
- Reposition: dropdown recomputes top/left on `resize` and `scroll` (capture phase) while open

## Props (read from source)

| Name | Type | Required | Purpose |
|------|------|----------|---------|
| `compact` | boolean | no, defaults `false` | Render the stripped mobile-menu variant |

## Tokens used

`var(--color-muted-foreground)`. Uses inline styles for mobile compact variant (`#cfd3d6` for label color — should be a token but isn't yet; track in `_index.md` Token gaps). Position math (`gutter: 12`, `top: rect.bottom + 8`) is in source, not CSS.

## Tone & copy rules

- Trigger label: **"Account"** (Title Case, single word)
- Menu items in **Title Case**: "Profile", "Transcription History", "Sign out" (sentence case here — last item is the only deliberate divergence; matches Clerk/auth conventions)

## Do / Don't

- **Do** add new menu items by appending a `<button.account-dropdown-item>` before the divider; keep "Sign out" last.
- **Do** keep dropdown rendering via `ReactDOM.createPortal(..., document.body)` so it escapes header stacking contexts.
- **Don't** call `useClerk` directly from `@clerk/clerk-react` — use the local `'../auth'` wrapper.
- **Don't** add hover-open behavior. AccountIcon dropdown is **click-toggled**; only the Header Products dropdown is hover-driven.

## Drift from generated spec

`preview/component-avatar.html` shows a circular avatar with image; current FE renders a Phosphor `User` glyph (no profile photo). `preview/component-dropdown.html` shows a generic dropdown with checkboxes/separators; the real menu is a flat list of three actions plus one divider. **FE wins** — when scaffolding new menus that hang off an avatar/account trigger, mirror this structure (button + portal + backdrop + click-outside cleanup) rather than the preview's chrome.
