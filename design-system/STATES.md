# Loading & Status States

Site-wide conventions for **loading placeholders** and **status / error messages**.
Two shared primitives — use these instead of ad-hoc text. Never ship a plain
`Loading…` string or a bare red `<p>`.

## Loading → `SkeletonPanel`

`src/components/ui/SkeletonPanel.js`

A **breathing, rounded gray panel** that holds a loading layout's geometry.
Opacity pulses `0.45 → 1 → 0.45` with a subtle scale over `1.6s`; stacked
panels stagger; honors `prefers-reduced-motion`.

> Note: the design-system reference skeleton (`preview/component-skeleton.html`)
> uses a shimmer *sweep*. The app deliberately uses a softer **breathing pulse**
> for full-panel content loads — that is the product decision, applied everywhere.

```jsx
import SkeletonPanel from './ui/SkeletonPanel';

{loading && <SkeletonPanel count={3} height={132} />}   // list / cards
{loading && <SkeletonPanel count={1} height={120} />}   // single summary block
{loading && <SkeletonPanel count={4} height={52} />}    // table rows
```

Props: `count` (number of stacked panels), `height` (px or CSS length), `style`, `className`.

Rule: match `height`/`count` to the real content's geometry so the layout
doesn't jump when data arrives.

## Status / errors → `StatusMessage`

`src/components/ui/StatusMessage.js`

Inline banner for error / warning / info / success. Mirrors the design system
"Toast & banner" banner spec and the `color-status` palette.

```jsx
import StatusMessage from './ui/StatusMessage';

<StatusMessage variant="error" title="Couldn't load history">{error}</StatusMessage>
<StatusMessage variant="error">File too large. Maximum upload size is 32 MB.</StatusMessage>
<StatusMessage variant="warning" title="Almost out of minutes">…</StatusMessage>
<StatusMessage variant="info">MusicXML copied to clipboard.</StatusMessage>
<StatusMessage variant="success" title="Transcription complete">…</StatusMessage>
```

- `variant`: `error` (default) · `warning` · `info` · `success`
- `title` optional — with a title you get a bold accent heading + neutral detail;
  without one it's a single accent-colored line (`--bare`).
- Each variant = **solid accent fill with white text** (filled panel, not a tint),
  white icon + title, softened-white detail. `error`/`warning` get `role="alert"`,
  others `role="status"`.

### Status palette (tokens in `src/styles/tokens.css`)

| Token | Hex | Use |
|-------|-----|-----|
| `--color-danger` | `#ff6b6b` | Error · destructive · failed job |
| `--color-success` | `#22c55e` | Completed · confirmed · plan active |
| `--color-warning` | `#ffb020` | Quota / billing warnings |
| `--color-info` | `#93b4ff` | Neutral informational |

Use status colors **sparingly** — only for genuine status, never decoration.
