# GrooveSheet Design System

GrooveSheet is an AI-powered music transcription web app. You upload an audio file (MP3 / WAV / FLAC / OGG, up to 32 MB) and a few seconds later you get back clean drum/bass/piano/vocal notation as PDF, MusicXML, and MIDI. The product is sold as a freemium SaaS with monthly minute allowances and one-time top-ups.

The brand reads as **studio-grade tooling for working musicians** — confident, technical, and a little playful. Brand color is a single, saturated cobalt blue (`#012FA7`) sitting on a near-black canvas, with one signature flourish: a soft blue dot-grid pattern that runs through every dark surface like sheet music staff lines.

> Internally the codebase still references its previous name "DrumScore" in some files (e.g. the footer copyright). The user-facing brand is **GrooveSheet** everywhere new is built.

---

## 📚 Sources

This design system was reverse-engineered from the following:

- **Codebase:** [`groovesheet/groovesheet-fe`](https://github.com/groovesheet/groovesheet-fe) on the `main` branch.
  Key reference files inside that repo:
  - `docs/DESIGN_SYSTEM.md` — the canonical design guidelines (colors, type, components).
  - `src/styles/tokens.css` — the production CSS variables.
  - `src/components/Hero.{js,css}` — upload card, the central interaction.
  - `src/components/Pricing.{js,css}` — pricing card pattern + button system.
  - `src/components/Features.{js,css}` — outlined-illustration feature cards on a colored chrome.
  - `src/components/Testimonials.{js,css}` — three-column quote wall.
  - `src/components/FAQ.{js,css}` — two-column FAQ accordion.
  - `src/components/layout/Header.{js,css}` and `Footer.{js,css}` — chrome.
  - `TASK390_groovesheet_account_page_PRD.md` — account page spec (informs UI kit `/account`).
- **Brand assets uploaded by the user:** `GrooveSheet_logo.svg`, the marks in black/white/gray, and the wordmark.

Nothing here was invented from screenshots — every value (color, spacing, font size) is either lifted from the codebase or is an obvious extension of an existing pattern.

---

## ✍️ Content Fundamentals

GrooveSheet's voice is **direct, working-musician casual**. It speaks like a friend who's been on the gig, not a marketing team. Sentences are short. Verbs do the work.

### Tone

- **Confident, never breathless.** "Get scores in seconds — not weeks." Says what it does, doesn't oversell.
- **Concrete, not abstract.** Hero subtext mentions *"tempo, time signatures, and drum events"* and *"Max 10 MB"* — actual specs sit next to the marketing line. Pricing features read like a checklist: *"120 minutes / month"*, *"500 MB upload/file"*, *"Batch processing"*.
- **Plays well with technical jargon.** The site comfortably says *"MusicXML"*, *"tempo map"*, *"ghost-note sensitivity"*, *"kit mapping"*. Audience is assumed to know what those mean.
- **Slightly playful.** Feature card three is titled simply **"Export!"** — the only exclamation mark on the homepage. Testimonials are written as actual musician slang: *"locked to the click"*, *"finally nailed that triplet fill"*.

### Person & address

- **Second-person, "you".** "Upload your track." "We detect tempo." "You can then process each segment." Customer is always *you*; the product is *we*.
- **No corporate "our team is committed to…"** ever.

### Casing

- **Title Case for headings and CTAs.** "Get Scores In Seconds — Not Weeks." "Upload Your Track." "Browse Files." "Most Popular."
- **Sentence case for body, FAQ questions, and form labels.** "How do I sign up/sign in?" "Drag in an MP3 (or choose one)."
- **ALL CAPS only for plan badges and the "MOST POPULAR" ribbon** — used as decorative tags, never headings. (`HOBBYIST`, `PROFESSIONAL`, `ENTERPRISE`, `MOST POPULAR`.)

### Punctuation

- En dash with surrounding spaces for asides: *"Get Scores In Seconds — Not Weeks."*
- Em dash without spaces inside FAQ answers: *"live recordings may work but results vary—studio-quality recordings produce the best notation."*
- "/" used for OR-style options and units: *"sign up/sign in"*, *"100 MB upload/file"*, *"10 minutes / month"*.
- Numbers are written as digits (10 minutes, 120 minutes, $10) even at the start of bullets.

### Emoji

- **Not in product UI.** No emoji buttons, badges, or in-app text.
- Emoji appear only inside `docs/DESIGN_SYSTEM.md` itself as section markers (🎨 📝 🔘). Treat that as documentation flavor, not product convention.

### Specific copy examples to lift

- Hero: *"Get Scores in Seconds - Not Weeks."* / *"Built for speed and accuracy so you can focus on practice, teaching, and performance."*
- Feature card titles: **Upload Your Track / Customize Instantly / Export!**
- Pricing tagline: *"Affordable Plans For Everyone."* / *"Try it free today. Upgrade for higher limits and advanced features without breaking the bank."*
- Plan subtitles: *"For individuals"* (Free) / *"Best for small teams"* (Lite) / *"Designed for companies"* (Pro).
- Disclaimer pattern: *"By uploading a file, you agree to our Terms of Service and Privacy Policy."* — small, light weight, links underlined.
- FAQ question phrasing: short, plainly worded, never clever. *"What happens if a job fails?"*

---

## 🎨 Visual Foundations

### Color vibe

A single cobalt-blue accent (`#012FA7`) on a near-black canvas (`#171717`). The blue is **saturated, slightly cool, and never gradient-faded** — it appears at full strength on every CTA, every popular-plan ribbon, every feature-card chrome. There is exactly one place on the homepage where blue gradients into a slightly lighter blue: the progress bar fill (`linear-gradient(90deg, #012FA7, #0139C7)`).

Light mode (toggleable, `data-theme="light"`) flips the canvas to pure `#FFFFFF` over `#F6F6F6` panels and keeps the same brand blue.

### Typography

- **One typeface: Hubot Sans**, weights 300 / 400 / 500. Rendering is `-webkit-font-smoothing: antialiased` everywhere.
- Hierarchy is built on **size and color**, not weight — most headings are weight 400. Weight 500 is reserved for buttons, emphasized labels, and feature card titles. Weight 300 is for fine-print disclaimers.
- Type is generous and slightly airy: hero is `60px / 76.8px line-height`, section headings sit at `40px / 52px` with `-0.8px letter-spacing`. Buttons are tiny by comparison (`14px / 18.2px`).
- Numerals in pricing are big and *light* (48px / weight 300) so the dollar amount feels handsome rather than aggressive.
- DM Sans is loaded as a backup alt face for any place that needs a slightly different feel; in practice it is rarely used.

### Backgrounds & surfaces

- **The dot grid is the brand's signature.** Every dark section paints a fixed background of `radial-gradient(circle, #171E43 1.5px, transparent 1.5px)` at `43px × 43px` spacing, ~35% opacity. It looks like staff paper that's been shrunk and turned into wallpaper. Light mode swaps the dot color to `#B8D4FF`.
- **Panels stack three depths deep** in dark mode: `#171717` (canvas) → `#212121` (panel2) → `#323033` (panel1, the "lifted" surface used for cards and the upload area). Panel3 (`#1A1A1A`) is for tinted backgrounds inside compound cards.
- **No imagery in the marketing flow except product screenshots.** The homepage uses a single `Preview.png` of actual generated notation, plus per-plan/per-step illustrations rendered as **outlined SVG line drawings** (arrows, hands, a wave, a pencil, a check, a smile) — see `Features.js`. These are stroked, not filled, and inherit `currentColor`.
- **No gradients used decoratively.** The only gradients in the codebase are: the upload card's translucent glass surface (`rgba(255,255,255,0.05–0.08)` linear), the progress bar's blue-to-blue, and the "fade-down" mask above the Features section.

### Borders & dashes

- **Dashed borders mean "drop something here"**. The upload area uses a `2.842px dashed` border in `rgba(255,255,255,0.18)`; on drag-over it switches to solid brand blue.
- Solid 1px borders use `rgba(255,255,255,0.1)` or `0.18` — barely there, used to separate stacked dark surfaces.
- Pricing card "MOST POPULAR" is rendered as **a 12px-thick blue picture frame** painted around the inner card, not a banner. This is the most distinctive border treatment in the system.

### Cards

- **Card radii are layered.** Outer chrome on the popular pricing card is `16px`; inner panel is `13px`; small interactive items round to `12px`, `8px`, `6px`, `4px`. The 16/13 outer/inner pairing is intentional and creates the "frame" look.
- **Cards never have heavy drop shadows.** The only place shadows appear: the upload card uses `0 8px 32px 0 rgba(0,0,0,0.37)` plus inset `0 1px 1px rgba(255,255,255,0.15)` to look like floating glass. Other cards rely entirely on contrast against the canvas.
- **Backdrop blur** (`backdrop-filter: blur(20px) saturate(180%)`) is used on the upload area only, to give the dashed-glass look.

### Buttons

- **Primary**: solid `#012FA7`, white text, weight 500. Two shapes coexist: pill (`border-radius: 120px`) for compact actions and rectangular (`border-radius: 6px`) for "primary action of a screen" buttons (Browse Files, Download).
- **Outline**: transparent with a thin border (`#E5E5E5` light / `rgba(255,255,255,0.18)` dark) and `#F4F4F4` text.
- Hover: brighten to `#0139C7`. Press: `#0138C0`. Disabled: `#666` at `0.6` opacity.
- Buttons aggressively kill browser defaults: `outline: none; box-shadow: none; -webkit-appearance: none;` and a Firefox `::-moz-focus-inner` reset.

### Animation & motion

- **Slow, soft theme crossfade.** A global `* { transition-property: background-color, color, border-color, background-image; transition-duration: 1.2s; }` rule means toggling dark/light mode actually *fades* over more than a second. This is unusual and characteristic.
- **Default UI motion is fast (`0.2s–0.3s ease`)** — hover state changes, dropdown opens, tab indicator slides.
- **Hover lift** is `translateY(-2px)` on cards/buttons. **Press lift** on close buttons is `scale(1.1)`.
- **No bounce, no spring physics, no parallax**. Two custom keyframes only: `fadeIn` (opacity 0→1) and `slideUp` (translateY 30px→0).
- Confetti fires once on successful transcription completion (`canvas-confetti`, 50 particles per 250ms interval for ~3 seconds). It is the single celebratory moment in the product.

### Hover & press states

- Hover: lighten background (`+8% brightness` via `rgba(255,255,255,0.05)`), or shift to brand blue.
- Press: darken the brand blue (`#0138C0`).
- Focus: deliberately *invisible* — `outline: none; box-shadow: none` — accessibility note flagged in the design doc.

### Inputs

- Dark inputs sit on `#232226` with a `1px solid #3D3B3E` border and `#8D8C8D` placeholders. Light inputs use `#F6F6F6` with `#E5E5E5` borders.
- All inputs share the same border radius (`6px`) and 14–16px text size.

### Layout

- **Container max widths** are very specific: hero/header `1414px`, content `1190px`, hero text `660px`, upload area `586px`. Sections pad horizontally `20px`, vertically `80px`.
- **Header is transparent and floats over the dot grid.** No drop shadow, no background. The brand mark and nav menu sit directly on the canvas.
- **Footer is simple.** Logo + 16 social icons (Phosphor `weight="fill"`) on the left, two link columns + language selector on the right, copyright + legal at the bottom.

### Iconography

See dedicated section below.

### Imagery vibe

- Product screenshots only (notation rendering — `Preview.png`, screenshots of the workspace UI for the About page). No stock photography. No illustrated humans. No 3D renders.
- Auth modal uses corner-photo backgrounds for each provider button (`Google_Bg.png`, `Apple_Bg.png`, etc.) — small, decorative, slightly muted.
- Color in imagery: same cobalt blue + neutrals, no warm tones.

### Use of transparency & blur

Used **once** with intent: the upload card. Glass effect (`rgba(255,255,255,0.05–0.08)` + `backdrop-filter: blur(20px) saturate(180%)`) signals the most important interaction on the page. Everywhere else, surfaces are opaque.

### Layout fixed-elements

- The header sits in the document flow (not `position: fixed`), so it scrolls away. The single fixed element is the dot-grid background.
- Z-index layers: dots (0) → hero bg (1) → content (10) → modal overlay (`2147483647`, deliberately maxed out).

---

## 🪧 Iconography

GrooveSheet uses **two icon systems in parallel**, both via npm packages — there is no custom icon font.

### 1. Phosphor Icons (`@phosphor-icons/react`)

The primary icon library for **product UI**. Used for:

- All footer social icons (`FacebookLogo`, `InstagramLogo`, `XLogo`, `YoutubeLogo`, `TiktokLogo`, `RedditLogo`, `GithubLogo`, `LinkedinLogo`, `DiscordLogo`, `DevToLogo`, `SoundcloudLogo`, `MediumLogo`, `ThreadsLogo`, `TumblrLogo`, `TwitchLogo`, `PinterestLogo`).
- Header chrome, account icon, dropdown chevrons.
- Always rendered with `weight="fill"` for socials, `weight="regular"` for UI controls.
- Default size in product is 28–32px for socials, 14–22px for UI.

For external decks/mockups in this design system we link Phosphor's web font from the CDN (see `SKILL.md`).

### 2. Lucide React (`lucide-react`) and `react-icons`

Used **specifically for instrument selection** in the upload card and a handful of secondary places. Examples:

- `LuGuitar`, `LuMusic4`, `LuDrum` from `react-icons/lu`.
- `Piano` from `lucide-react`.
- `LiaMicrophoneAltSolid` from `react-icons/lia`.

Stroke-based, 22.738px in the instrument tab list, `currentColor`. Mixed-library because no one library covers all instruments cleanly.

### 3. Hand-rolled outlined SVG illustrations

Each homepage feature card has a pair of large **stroked-only line drawings** — arrow, hands, pencil, check, smile, wave. They are inline `<svg>` with `stroke="currentColor"`, `strokeWidth: ~5px`, no fills. They look hand-drawn but are mathematically clean; treat them as a third "icon set" (decorative, illustration-scale).

We've left these illustrations in the codebase in `src/components/Features.js`; copy them inline when reproducing the homepage. We have not duplicated them as standalone SVG files because they're tightly coupled to the `<svg>` markup.

### Emoji

**Not used in product.** They appear in `docs/DESIGN_SYSTEM.md` and this README as section dividers. Don't ship them in UI.

### Unicode characters as icons

Not used. Where you'd expect a "→" arrow inside a button, GrooveSheet uses a rendered SVG chevron (see `Pricing.js` button arrow paths).

---

## 🗂 Index

```
README.md                    ← you are here
SKILL.md                     ← agent skill manifest
colors_and_type.css          ← all CSS variables and semantic type classes

assets/
  logos/                     ← brand marks in every variant
  images/                    ← product screenshots, auth backgrounds
  fonts/                     ← (Hubot Sans loaded via Google Fonts; no local files)

preview/                     ← Design System tab cards
  type-*.html                ← typography specimens
  color-*.html               ← color palettes
  spacing-*.html             ← spacing, radii, elevation
  component-*.html           ← buttons, inputs, cards, badges
  brand-*.html               ← logos, dot pattern

ui_kits/
  marketing/                 ← homepage / pricing / about — the public-facing site
  app/                       ← signed-in product (upload card, history, account page)
```

### UI kits

- [`ui_kits/marketing/`](ui_kits/marketing/index.html) — recreates the public homepage: header, hero with upload card, features, pricing cards, testimonials, FAQ, footer.
- [`ui_kits/app/`](ui_kits/app/index.html) — recreates the signed-in product surfaces: the active upload card with progress, transcription history list, and the account/billing page from `TASK390_groovesheet_account_page_PRD.md`.

---

## ⚠️ Caveats

- **Hubot Sans:** the official variable font ships locally from `assets/fonts/HubotSans-VariableFont_wdth_wght.ttf` (and italic). `colors_and_type.css` declares `@font-face` rules with weight 200–900 and width 75–125%, so all weights and widths are available — including italic.
- **The codebase still says "DrumScore"** in `README.md` and the footer copyright. We've used **GrooveSheet** everywhere in this design system per the brand assets. Flag if a different convention is wanted.
- **Hand-rolled feature illustrations** are kept inline in source. If you need them as standalone SVGs in `assets/`, ask and we'll extract.
