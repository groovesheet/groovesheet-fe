---
name: design-system
description: Use when designing or scaffolding any UI in groovesheet-fe — new pages, new components, redesigns, refactoring component CSS, generating React/JSX. Triggers on mentions of components, pages, marketing surfaces, dark/light theming, dot grid, glass morphism, Hubot Sans, design tokens, buttons, cards, pricing, modals, dropdowns, navigation, forms, sheet music viewer, MIDI editor, piano roll, transcription cards, upload flows.
---

# GrooveSheet Design System Skill

You are working in `groovesheet-fe/`, a React 18 + CRA + Tailwind v3 frontend for an AI music transcription web app. This skill enforces the design system at `design-system/` — the canonical source of truth for visual design, voice, and component patterns.

## The core rule

**FE components are the source of truth. The generated `preview/*.html` mockups are pictures, not implementations.** When the two disagree, the FE wins. Never copy markup from a preview HTML if a real FE component exists for that pattern.

## Before generating any UI

1. **Open `design-system/components/_index.md`** and find the closest matching pattern.
   - If it's `documented`: read its spec file in `design-system/components/<Name>.md` — that file cites the real source path. Read the source. Mirror its prop shape, anatomy, and token usage.
   - If it's `gap` (preview-only, not yet built): the `preview/component-<x>.html` is the spec. Build matching the preview but follow the FE's framework conventions below.
2. **Open `design-system/VISUAL_GUIDE.md`** for tone, typography, color, motion, and copy rules. Apply them.
3. **Open `design-system/tokens.reference.css`** to see the full token spec; cross-check against runtime `src/styles/tokens.css`. **Use only runtime tokens.** If a value you need isn't in runtime, hard-code (matching existing components) and note the gap — do not silently add a new variable to `tokens.css`.

## FE conventions (these are non-negotiable)

- **React 18 + CRA + JS (no TS).** No `.ts`/`.tsx` — match existing `.js` extension.
- **Component CSS file pairing.** Every component pairs with a sibling `<Name>.css` in the same directory (e.g., `Header.js` + `Header.css`). Don't move styles to global. Tailwind utility classes can be mixed inline alongside the component CSS file.
- **Imports from `'../auth'`** (the local wrapper), not `@clerk/clerk-react` directly. The wrapper exports `SignedIn`, `SignedOut`, `useAuth`, `useClerk`, `useUser`, `useSignIn`, `useSignUp`.
- **API calls go through `src/utils/api.js`** — `authenticatedFetch`, `uploadFileAuthenticated`, `fetchWorkflowList`, `fetchWorkflowStatus`, `downloadWorkflowFile`. Always pass `getToken` from `useAuth()`. Always hit `/api/...` (proxied in dev, rewritten in prod).
- **Theme via `useTheme()`** from `src/context/ThemeContext`. Read `isDarkMode`; call `toggleTheme()` to switch. Don't manipulate `document.body.classList` for theme.
- **Modals + dropdowns render via `ReactDOM.createPortal(node, document.body)`** with `z-index: 2147483647` to escape header stacking contexts. See `Header.js` (Products dropdown), `AccountIcon.js`, `LoginModal.js` for the pattern.
- **Icons:** `@phosphor-icons/react` for chrome (regular weight default, fill for socials/active states); `lucide-react` and `react-icons` for instruments only. No emoji in product UI.
- **Logos:** read from `public/images/Logo_White.png` (dark) and `Logo_Dark.png` (light). The PNG/SVG variants in `design-system/assets/logos/` are reference-only.

## Visual rules (condensed from VISUAL_GUIDE.md)

- **Dark default.** Light is `data-theme="light"` toggle. Both share brand blue `#012FA7`.
- **Dot grid** is the brand signature — `radial-gradient(circle, var(--color-dot-pattern) 1.5px, transparent 1.5px)` at `43px × 43px`, ~35% opacity, fixed background.
- **Container max-widths:** Header / Footer / hero `1414px`, content `1190px`, hero text `660px`, upload area `586px`. Section padding `20px` horizontal, `80px` vertical.
- **Glass morphism is used once** — only on the Hero upload card (`backdrop-filter: blur(20px) saturate(180%)`). Don't add it elsewhere.
- **Card radii are layered:** outer `16px`, inner `13px`, smaller items `12 / 8 / 6 / 4 px`. The 16/13 outer/inner pair on the popular pricing card creates the "blue picture frame" — don't break this if reusing.
- **No decorative gradients.** The only gradients in the system are the upload progress bar (`linear-gradient(90deg, #012FA7, #0139C7)`) and the upload-card translucent glass.
- **Motion:** UI transitions `0.2s–0.3s ease`. Theme crossfade `1.2s` (intentionally slow). Hover lift on cards/buttons: `translateY(-2px)` (Button uses `-1px`). One celebratory animation: `canvas-confetti` on transcription success.
- **Two-axis hierarchy** — size + color, not weight. Most headings are weight 400. Weight 500 = buttons + emphasized labels. Weight 300 = fine-print disclaimers.

## Tone & copy

- **Title Case** for headings and CTAs ("Get Scores in Seconds", "Upload Your Track", "Browse Files", "Most Popular").
- **Sentence case** for body, FAQ questions, form labels ("How do I sign up/sign in?", "Drag in an MP3 (or choose one).").
- **ALL CAPS** only for plan badges and "MOST POPULAR" ribbon (`HOBBYIST`, `PROFESSIONAL`, `ENTERPRISE`).
- **En dash with surrounding spaces** for asides in headings ("Get Scores In Seconds — Not Weeks."). **Em dash without spaces** inside FAQ answers.
- **Numbers as digits** even at start of bullets ("10 minutes / month", not "Ten minutes…").
- **No emoji in product UI.** Emoji appear only as section dividers in `docs/` markdown.
- **Voice:** working-musician casual. "you" for the user, "we" for the product. Short sentences, verbs do the work. Concrete specs side-by-side with marketing copy.

## Buttons

The canonical primitive is `src/components/ui/Button.js`. Use it:

```jsx
import Button from '../components/ui/Button';
// or
import { Button } from '../components/ui';

<Button variant="primary" size="medium" onClick={...}>Browse Files</Button>
<Button variant="outline" size="small">Cancel</Button>
```

- Variants: `primary` (default, `#012FA7` solid) | `secondary` (muted gray) | `outline` (transparent, primary border)
- Sizes: `small` | `medium` (default) | `large`
- Hover: `translateY(-1px)` + glow on primary; outline inverts.

**Don't** create one-off `<button>` elements with custom CSS for "primary" actions. They drift. Marketing pages (Hero, Pricing) have inline pill / circular buttons because they predate the primitive — when extending those areas, mirror the inline pattern; everywhere else, use `Button`.

## Component-truth checklist

Before writing any new component, answer:

1. Does a similar pattern already ship? Check `_index.md`. If yes, read its spec + source.
2. Which `var(--color-*)` tokens are used by the closest existing component? Use those. Don't introduce new variables.
3. Does the new component need a portal (modal, dropdown)? Use `ReactDOM.createPortal(..., document.body)` with `z-index: 2147483647`. See LoginModal / AccountIcon.
4. Is auth involved? Import from `'../auth'`. API calls go through `src/utils/api.js`.
5. Is upload involved? Mirror the Hero state machine (`idle → uploading → cold_starting → processing → success`). The note in `Hero.js` line ~47 flags shared download key conventions across Hero / MidiConverter / StemSplitter / TranscriptionHistory — keep them in sync.
6. Have I followed the tone rules — Title Case CTA, no emoji, sentence-case body?

## When in doubt

- Spec contradicts source code: trust the source. Update the spec in the same PR (`design-system/CONTRIBUTING.md` Rule 1).
- Preview HTML contradicts source code: trust the source. Note the divergence in the spec's "Drift from generated spec" section.
- Token missing from runtime but present in `tokens.reference.css`: hard-code the value matching existing components, log it in `_index.md` "Token gaps". Don't silently extend `src/styles/tokens.css`.
- A pattern doesn't exist yet (preview-only / gap status): build it matching the preview's visual spec, but using FE conventions (component CSS file, JS not TS, real auth wrapper, etc.).

## Quick file reference

- Visual + voice guide: `design-system/VISUAL_GUIDE.md`
- Component index: `design-system/components/_index.md`
- Per-component specs: `design-system/components/<Name>.md`
- Token spec (read-only reference): `design-system/tokens.reference.css`
- Runtime tokens (use these): `src/styles/tokens.css`
- Visual reference HTMLs: `design-system/preview/component-*.html`
- FE conventions: `CLAUDE.md`
- API helpers: `src/utils/api.js`
- Theme context: `src/context/ThemeContext.js`
- Auth wrapper: `src/auth.js` (or `src/auth/`)
