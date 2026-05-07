# Header

**Source of truth:** `src/components/layout/Header.js` (+ `Header.css`)
**Visual reference:** `preview/component-menu.html` (nav patterns), `preview/component-dropdown.html`
**Status:** documented

The site-wide top navigation. Transparent over the dot grid; floats in document flow (not `position: fixed`).

## Anatomy

```
<header.header>
  <div.header-container>
    <div.header-inner>
      <div.header-left>
        <Link.logo>            ← theme-aware logo (Logo_White / Logo_Dark from /public/images/)
        <nav.nav-menu>
          <div.nav-item.dropdown.nav-products>   ← Products w/ chevron, opens portal dropdown
          <a.nav-item> Pricing
          <a.nav-item> Help
          <Link.nav-item> About
          <Link.nav-item> Blog
      <div.header-right>
        <button.theme-toggle>  ← sun/moon SVG, hits useTheme()
        <div.language-selector.desktop-only> En ⌄
        <SignedOut><button.login-btn.desktop-only>Log in
        <SignedIn><AccountIcon />
        <button.hamburger-menu>  ← 3 spans, mobile only

  ; rendered via createPortal to document.body when open:
  <div.products-dropdown>      ← desktop hover dropdown, z-index 2147483647
  <div.mobile-menu-backdrop> + <div.mobile-menu-dropdown>
```

## Variants & states

- **Theme:** dark / light, driven by `useTheme()` from `src/context/ThemeContext`. Logo image swaps on `isDarkMode`.
- **Auth:** `<SignedOut>` shows `Log in` button (calls `onLoginClick` prop); `<SignedIn>` mounts `AccountIcon`. Both gates come from the local `'../../auth'` wrapper module.
- **Products dropdown:** opens on `mouseEnter`, closes on `mouseLeave` after 80ms timeout. Position computed from `getBoundingClientRect`. Items: Music Transcription (`/`), Stem Splitter (`/stem-splitter`), MIDI Converter (`/midi-converter`).
- **Mobile menu:** opens via hamburger; renders portal with backdrop. Auto-closes on resize > 1024px. Inside: collapsible Products section + Pricing / Help / About / Blog / language / Log in or Account.

## Props (read from source)

| Name | Type | Required | Purpose |
|------|------|----------|---------|
| `onLoginClick` | function | no | Called when Log in button is pressed; opens `LoginModal` from the parent shell |

## Tokens used

`var(--color-foreground)`, `var(--color-border)`, `var(--color-panel1)`, `var(--color-panel2)`, `var(--color-muted-foreground)`, `var(--color-primary)`. Layout uses raw `1414px` max-width (matches Footer / hero container).

## Tone & copy rules

- Nav items in **Title Case** ("Products", "Pricing", "Help", "About", "Blog")
- Login button text: "Log in" (sentence case, two words)
- Phosphor icons use `weight="regular"` for chrome controls

## Do / Don't

- **Do** add new top-level routes by appending to the `nav-menu` and `mobile-menu-content` blocks together — desktop and mobile must stay in sync.
- **Do** render new dropdown menus through `ReactDOM.createPortal(..., document.body)` with `z-index: 2147483647` to escape stacking contexts (matches Products + mobile patterns).
- **Don't** make the header `position: fixed` — it's intentionally in document flow so it scrolls away.
- **Don't** add a background color in dark or light mode — the header stays transparent over the dot grid in both themes (CSS only transitions opacity-zero backgrounds).
- **Don't** import auth helpers from `@clerk/clerk-react` directly. Use `'../../auth'` (the wrapper exports `SignedIn`, `SignedOut`, `useClerk`, `useSignIn`, `useSignUp` matching Clerk's API).

## Drift from generated spec

- Logo `alt` text reads **"DrumScore Logo"** in source (legacy name); brand is GrooveSheet everywhere new is written. Don't rely on alt text for branding.
- `preview/component-menu.html` shows a single horizontal nav strip; the real header has a parallel mobile menu portal that matters for any nav change.
- Generated visual guide describes "the brand mark" but Header swaps PNG logos by theme — no SVG mark used here. Production logos live in `public/images/Logo_White.png` and `public/images/Logo_Dark.png`, **not** in `design-system/assets/logos/`.
