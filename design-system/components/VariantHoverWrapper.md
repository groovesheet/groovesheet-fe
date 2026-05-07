# VariantHoverWrapper

**Source of truth:** `src/components/VariantHoverWrapper.js`
**Visual reference:** —
**Status:** documented (placeholder)

Tiny wrapper that renders an `<img>` from `componentVector` inside a flex container. Exists as a placeholder for a richer hover-variant component referenced elsewhere (currently only in `Element.js`).

## Anatomy

```
<div className={...} aria-label="variant-{variant}">
  <img src={componentVector} alt="vector" />
```

## Props (read from source)

| Name | Type | Required | Purpose |
|------|------|----------|---------|
| `className` | string | no, defaults `''` | Forwarded utility classes |
| `componentVector` | string | no, defaults `'/images/vector-2.svg'` | Image src |
| `hover` | boolean | no, defaults `false` | Reserved (currently unused — the underscored `_hover` arg flag) |
| `variant` | string | no, defaults `'default'` | Aria label only |

## Tokens used

None directly. Inherits from parent.

## Do / Don't

- **Do** treat this as a placeholder. If hover variants become a real need, build them out here rather than introducing a new component.
- **Do** keep the `aria-label="variant-{variant}"` pattern — it's the only accessibility hint when no fallback alt is meaningful.
- **Don't** replace this with an inline `<img>` in callers without first checking other call sites.

## Drift from generated spec

Not in any preview. This is a vestigial / placeholder component. If you find yourself extending it, evaluate whether a real `<Hoverable>` primitive belongs in `src/components/ui/` instead.
