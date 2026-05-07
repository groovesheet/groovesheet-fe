# Features

**Source of truth:** `src/components/Features.js` (+ `Features.css`)
**Visual reference:** — (custom inline SVG illustrations, no preview HTML equivalent)
**Status:** documented

Three-card "how it works" block on the homepage. Each card pairs **two large stroked-only SVG illustrations** with a title + paragraph.

## Anatomy

```
<section.features>
  <div.features-container>
    <div.features-header>
      <h2>Get Scores in Seconds - Not Weeks.
      <p>Built for speed and accuracy...
    <div.features-cards>
      <div.feature-card> × 3
        <div.feature-card-inner>
          <div.feature-icons>
            <svg.feature-icon-{arrow|wave|hands|pencil|check|smile}>  ← 2 per card, stroked, currentColor
          <div.feature-content>
            <h3>{title}
            <p>{body}
```

Cards' content (verbatim — keep these copy strings if extending):
1. **"Upload Your Track"** — *"Drag in an MP3 (or choose one). We detect tempo, time signatures, and drum events automatically. Max 10 MB."* (icons: arrow + wave)
2. **"Customize Instantly"** — *"Adjust tempo map, barlines, kit mapping, and ghost-note sensitivity. See changes in the live preview."* (icons: hands + pencil)
3. **"Export!"** — *"Export clean notation to PDF, MusicXML, or MIDI. Print, share, or import into your editor."* (icons: check + smile)

## Variants & states

Static. No interaction.

## Props

None.

## Tokens used

`var(--color-foreground)`, `var(--color-primary)` (used as feature card chrome accent), `var(--color-panel1)`. Illustrations use `stroke="currentColor"` and inherit color from card chrome.

## The illustrations

Six hand-rolled SVG line drawings, inline in JSX (not extracted to standalone files). Stroke widths range 4–6px, no fills. Treat them as a **third icon set** for marketing purposes — alongside Phosphor (UI) and Lucide / react-icons (instruments).

If you need to reuse one of these illustrations elsewhere, copy the inline `<svg>` markup. Don't try to import them — they're tightly coupled to the card sizing.

## Tone & copy rules

- Section title: **"Get Scores in Seconds - Not Weeks."** (matches Hero — keep them in sync)
- Card titles: **Title Case** ("Upload Your Track", "Customize Instantly")
- **"Export!"** is the only exclamation mark on the homepage. Don't add more — it's deliberately the singular playful note.
- Body copy: short sentences, concrete specs ("Max 10 MB", "tempo, time signatures, and drum events")

## Do / Don't

- **Do** keep illustrations stroked-only with `currentColor`. No fills, no gradients.
- **Do** preserve the section title's match with the Hero headline (intentional repetition).
- **Don't** swap illustrations for stock icons or 3D renders — the line drawings are part of the brand voice.
- **Don't** add a 4th card. Three is the rhythm of the section; restructure if you need more content.

## Drift from generated spec

`VISUAL_GUIDE.md` (visual_guide §Iconography) calls out these illustrations as a "third icon set, decorative, illustration-scale." There is no per-illustration preview HTML — the illustrations live only in `Features.js`. If you need them in a deck or external mockup, copy the inline SVG markup directly from source.
