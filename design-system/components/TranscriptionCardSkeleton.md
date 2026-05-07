# TranscriptionCardSkeleton

**Source of truth:** `src/components/TranscriptionCardSkeleton.js` (+ `TranscriptionCardSkeleton.css`)
**Visual reference:** `preview/component-skeleton.html`
**Status:** documented

Loading placeholder for `TranscriptionCard`. Same outer dimensions and layout, but every text / button slot is a colored block waiting for real data.

## Anatomy

```
<div.transcription-card-skeleton>
  <div.skeleton-header>
    <div.skeleton-metadata>
      <div.skeleton-date />
      <div.skeleton-divider />
      <div.skeleton-time />
    <div.skeleton-filename />
  <div.skeleton-downloads>
    <div.skeleton-button /> × 3
```

Mirrors `TranscriptionCard` structure 1:1 so the layout doesn't reflow when real data swaps in.

## Variants & states

Static. CSS pulse / shimmer animation in `TranscriptionCardSkeleton.css` (read CSS for current keyframe — likely a 1.5s background-position pulse).

## Props

None.

## Tokens used

`var(--color-panel1)`, `var(--color-border)`, `var(--color-surface-light)` (the shimmer overlay).

## Tone & copy rules

N/A — no copy.

## Do / Don't

- **Do** keep this in lockstep with `TranscriptionCard` anatomy. If you add a fifth download button to the real card, add a fifth skeleton block here.
- **Do** render exactly 3 skeleton-buttons (matches the median real card; the empty 4th slot is OK while loading).
- **Don't** animate with JS. Pulse is pure CSS.

## Drift from generated spec

`preview/component-skeleton.html` shows generic skeleton primitives (lines, circles, rectangles). The real `TranscriptionCardSkeleton` is a single-purpose layout-locked placeholder for one specific card. There is no shared `<Skeleton>` primitive yet — that's a `gap` candidate in `_index.md`. If you build one, generalize from this component.
