# VisualizationTabs

**Source of truth:** `src/components/visualization/VisualizationTabs.js` (no separate CSS — uses parent `VisualizationPanel.css`)
**Visual reference:** `preview/component-tabs.html`, `preview/component-segmented.html`
**Status:** documented

The toolbar inside `VisualizationPanel`. Left side: 3 tabs (Music Sheet / Piano Roll / MIDI Editor). Right side: 3 chrome buttons (theme, zoom, fullscreen).

## Anatomy

```
<div.viz-tabs-bar>
  <div.viz-tabs-left>
    <button.viz-tab[.viz-tab-active]> × 3
      <Phosphor icon, weight=fill if active else regular />
      <span>{label}</span>
  <div.viz-tabs-right>
    <button.viz-control-btn> theme toggle  (CircleHalf)
    <button.viz-control-btn> zoom in       (MagnifyingGlassPlus)
    <button.viz-control-btn> fullscreen    (CornersOut)
```

Tabs definition (constant in source):
```js
const TABS = [
  { id: 'sheet',     label: 'Music Sheet', Icon: Playlist },
  { id: 'pianoroll', label: 'Piano Roll',  Icon: PianoKeys },
  { id: 'editor',    label: 'MIDI Editor', Icon: PencilSimpleLine },
];
```

## Variants & states

- Active tab: icon swaps from `weight="regular"` to `weight="fill"` and gains `.viz-tab-active` class
- Chrome buttons are stateless (each invokes a callback)

## Props (read from source)

| Name | Type | Required | Purpose |
|------|------|----------|---------|
| `activeTab` | `'sheet' \| 'pianoroll' \| 'editor'` | yes | Controlled active tab id |
| `onTabChange` | function | yes | Called with new tab id |
| `onToggleTheme` | function | yes | Theme toggle handler |
| `onZoomIn` | function | yes | Zoom-in handler |
| `onFullscreen` | function | yes | Fullscreen handler |

## Tokens used

`var(--color-foreground)`, `var(--color-muted-foreground)`, `var(--color-border)`, `var(--color-primary)`, `var(--color-panel1)`.

## Tone & copy rules

- Tab labels: **Title Case** ("Music Sheet", "Piano Roll", "MIDI Editor")
- Aria labels: sentence case verb phrases ("Toggle theme", "Zoom in", "Fullscreen")
- Phosphor weight follows the system convention: `weight="regular"` for chrome, `weight="fill"` for active tab indicator

## Do / Don't

- **Do** add new tabs by extending `TABS` (and the corresponding view component in `VisualizationPanel`).
- **Do** keep chrome buttons stateless — they invoke callbacks; state lives in the parent.
- **Don't** add a "tab indicator slider" animation — the icon weight + class swap is the indicator pattern here.

## Drift from generated spec

`preview/component-tabs.html` and `preview/component-segmented.html` describe slightly different tab/segmented-control aesthetics. Real `VisualizationTabs` is closer to "tabs with chrome buttons on the right" than a pure segmented control. **FE wins** when scaffolding viewer toolbars; use the preview only for standalone segmented-control gaps.
