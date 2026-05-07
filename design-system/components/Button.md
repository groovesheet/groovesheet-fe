# Button

**Source of truth:** `src/components/ui/Button.js` (+ `Button.css`)
**Visual reference:** `design-system/preview/component-buttons.html`
**Status:** documented

The canonical button primitive. Re-exported from `src/components/ui/index.js`.

## Anatomy

- `<button>` with computed class string `button button--<variant> button--<size> [button--disabled] [<className>]`
- Single child slot for `children` (text + optional inline icons via JSX, no formal icon prop)

## Variants & states

| Variant | Background | Text | Border | Notes |
|---|---|---|---|---|
| `primary` (default) | `var(--color-primary)` (#012FA7) | `var(--color-button-light)` (#fff) | none | Standard CTA |
| `secondary` | `var(--color-surface-muted)` (#5f5e60) | `var(--color-button-light)` | none | Quieter action |
| `outline` | transparent | `var(--color-primary)` | `2px solid var(--color-primary)` | Inverts on hover (fills with primary, white text) |

| Size | Padding | Font size | Radius |
|---|---|---|---|
| `small` | 8px 16px | 14px | 6px |
| `medium` (default) | 12px 24px | 16px | 8px (inherited from `.button`) |
| `large` | 16px 32px | 18px | 10px |

States:
- Hover (non-disabled): `translateY(-1px)`, primary gets blue brighten + `0 4px 8px var(--color-primary-shadow)` glow
- Active: `translateY(0)` (snaps back)
- Focus: `2px solid var(--color-primary)` outline with 2px offset
- Disabled: `opacity: 0.5; cursor: not-allowed`; class `button--disabled` added

## Props (read from source)

| Name | Type | Required | Purpose |
|------|------|----------|---------|
| `children` | ReactNode | yes | Button content |
| `variant` | `'primary' \| 'secondary' \| 'outline'` | no, defaults `'primary'` | Visual style |
| `size` | `'small' \| 'medium' \| 'large'` | no, defaults `'medium'` | Padding + font size |
| `disabled` | boolean | no, defaults `false` | Native `disabled` + `button--disabled` class |
| `onClick` | function | no | Click handler |
| `className` | string | no | Appended to computed classes |
| `type` | string | no, defaults `'button'` | Native button `type` |
| `...props` | spread | no | Forwarded to underlying `<button>` |

## Tokens used

`var(--color-primary)`, `var(--color-button-light)`, `var(--color-primary-shadow)`, `var(--color-surface-muted)`, `var(--font-family-sans)`

## Tone & copy rules

- Title Case for primary CTAs ("Browse Files", "Get Started", "Upload Your Track")
- No emoji inside button text
- Verb-first phrasing — "Download MIDI", not "MIDI Download"

## Do / Don't

- **Do** use `Button` from `src/components/ui` for any new button. Import: `import Button from '../components/ui/Button'` or `import { Button } from '../components/ui'`.
- **Do** mix `variant` + `size` freely — both are independent.
- **Don't** introduce a new variant prop value without adding the matching `.button--<name>` CSS rule and updating this spec.
- **Don't** create one-off `<button>` elements with custom CSS for "primary" actions. They drift; use the primitive.

## Drift from generated spec

The generated `preview/component-buttons.html` and `SKILL.md` describe `.gs-btn` / `.gs-btn-primary` / `.gs-btn-pill` classes with 6px / 120px (pill) radius, padding `10px 20px`. The shipped `Button` uses **different class names** (`.button`, `.button--primary`) and **different default sizing** (`12px 24px`, `8px` radius for medium). **FE wins** — use `Button` props, not `.gs-btn` classes. The pill shape from the preview is not implemented as a Button variant; pill buttons in marketing surfaces (Hero, Pricing) are styled inline in their own component CSS.
