# Contributing to the Design System

Two rules. Both are about keeping `design-system/components/<Name>.md` honest about what's actually shipped in `src/components/`.

## Rule 1 — Update specs in the same PR

When you change any of the following on a component in `src/components/X.js` (or its CSS):

- Prop signature (added, removed, renamed, type changed)
- Visible anatomy (added/removed regions, header, footer, icon slot, etc.)
- States (new hover/active/loading/error variant)
- Tokens used (swapped a `var(--color-*)` for another)
- Copy rules baked into JSX (placeholder text, default labels)

…update `design-system/components/X.md` in the same PR.

## Rule 2 — Add a spec for every new top-level component

When you add a new file at `src/components/X.js` (or `src/components/<sub>/X.js`):

1. Create `design-system/components/X.md` from the template below.
2. Add a row in `design-system/components/_index.md` with status `documented`.
3. If the new component fills a `gap` row in `_index.md` (something that was preview-only), update the row to `documented` and replace the preview citation with the new source path.

## Spec template

```markdown
# <Name>

**Source of truth:** `src/components/<path>.js` (+ `<path>.css`)
**Visual reference:** `design-system/preview/component-<x>.html` (if applicable)
**Status:** documented | preview-only | gap

## Anatomy
- (parts list, top-down)

## Variants & states
- (default, hover, active, disabled, loading, error, etc.)

## Props (read from source)
| Name | Type | Required | Purpose |
|------|------|----------|---------|

## Tokens used
- `var(--color-...)`, `var(--font-...)` — list from component CSS

## Tone & copy rules
- (Title Case CTA, sentence-case label, voice notes from VISUAL_GUIDE.md)

## Do / Don't
- Do: ...
- Don't: ...

## Drift from generated spec
- (call out where current FE diverges from `preview/component-<x>.html`. **FE wins.**)
```

## Things that are NOT contributions

- Don't edit `tokens.reference.css` to "fix" what runtime should look like. That file documents the original design pass; runtime is `src/styles/tokens.css`. If you want to change runtime tokens, change runtime tokens.
- Don't edit `preview/*.html`. They're frozen reference. Drift goes into the component spec, not into the preview.
- Don't promote a `gap` to `documented` without a real component file in `src/components/`. The spec must cite a real source file.
