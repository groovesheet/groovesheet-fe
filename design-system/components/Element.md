# Element

**Source of truth:** `src/components/Element.js` (+ `Element.css`)
**Visual reference:** —
**Status:** documented

A homepage section card with a side-by-side "title + paragraph" header and a video-style preview area below. Imports `VariantHoverWrapper` for an inline play-button affordance.

## Anatomy

```
<div.element-section>
  <div.element-container>
    <flex header>
      <div max-width=420>
        <h_>High-Accuracy Drum<br/>Scores, On Demand.
      <p w=430>Upload a track, review the preview, download print-ready parts.
    <preview area, 617px tall>
      <bg image: /images/VIdeo.png>     ← yes, capital V — verify the file exists with this casing
      <play button overlay>
        <VariantHoverWrapper componentVector="/images/vector-2.svg" variant="nine" />
        <88×88 ring />
```

The play button is a translucent white pill (`#ffffff80` ring + bg) with a vector glyph inside.

## Variants & states

Static. No interaction.

## Props

None.

## Tokens used

`var(--color-text)` (note: this is the **text** alias, not `--color-foreground` — verify in `tokens.css`). Layout uses raw `420px` / `430px` widths and an exact `617.04px` preview height. Most styling is Tailwind utility classes inline (this file is the most Tailwind-heavy component).

## Tone & copy rules

- Headline: **"High-Accuracy Drum Scores, On Demand."** (Title Case, en dash usage allowed)
- Body: sentence case, concrete actions ("Upload a track, review the preview, download print-ready parts.")
- Two typefaces in use here: **Hubot Sans** for the headline (`'Hubot_Sans-Regular',Helvetica`) and **DM Sans** for the body (`'DM_Sans-Regular',Helvetica`) — one of the few places DM Sans is actually rendered. Keep this pairing if reusing the section.

## Do / Don't

- **Do** verify `/images/VIdeo.png` exists at that exact casing — the source uses capital V. Don't rename without checking the public folder.
- **Do** preserve the 420 / 430 split widths if reusing — they're load-bearing for the visual rhythm.
- **Don't** swap DM Sans for Hubot Sans in the body. The two-face pairing is intentional.

## Drift from generated spec

No preview reference. The "title-paragraph header + media preview" composition is FE-original. Closest preview is `preview/component-card.html` for outer chrome only.
