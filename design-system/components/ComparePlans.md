# ComparePlans

**Source of truth:** `src/components/ComparePlans.js` (+ `ComparePlans.css`)
**Visual reference:** `preview/component-table.html`
**Status:** documented

A flat feature-comparison grid for top-up packs. No header, no footer — just a section with "Compare Plans" title and a 4-column table (label + Lite pack + Pro pack + Plus pack).

## Anatomy

```
<section.compare-plans>
  <div.compare-container>
    <h2>Compare Plans
    <div.compare-table-wrapper>
      <div.compare-table>
        <div.compare-header-row>            ← (empty cell) | Lite pack | Pro pack | Plus pack
        <div.compare-row> × N               ← Minutes / Fast Processing Queue / Upload Size / Result Downloads / Batch Processing
          <div.compare-cell.feature-name>   ← left column label
          <div.compare-cell.feature-value>  ← either text ("90 Minutes", "2GB") or a checkmark SVG, or a dash
```

Note: this block lives **alongside** `Pricing` (separate section). It compares top-up packs, not subscription plans.

## Variants & states

Static. No interaction, no state. Three pack columns currently hard-coded in JSX.

## Props

None.

## Tokens used

`var(--color-foreground)`, `var(--color-border)`, `var(--color-panel1)`. Checkmark stroke color is hard-coded `#F4F4F4` (matches `--color-foreground` dark — should be a token; tracked in `_index.md` Token gaps).

## Tone & copy rules

- Section title: **"Compare Plans"** (Title Case)
- Pack headers: **"Lite pack"**, **"Pro pack"**, **"Plus pack"** (sentence case for "pack" — intentional, matches the in-product noun)
- Feature labels in **Title Case** ("Minutes", "Fast Processing Queue", "Upload Size Limit per File", "Result Downloads", "Batch Processing")
- Values in Title Case for units ("90 Minutes", "2GB")
- Dash for "not included": single en dash character `–`, not "✗" or "No"

## Do / Don't

- **Do** add new feature rows by appending another `<div.compare-row>` with one feature-name cell + N feature-value cells (one per pack column).
- **Do** keep the dash-for-absent / checkmark-for-present convention. No red ❌ or green ✅.
- **Don't** convert this to an HTML `<table>` element without verifying CSS still works — the current grid uses `<div>`s with CSS layout.
- **Don't** add a price row — pricing belongs in `Pricing`, not here.

## Drift from generated spec

`preview/component-table.html` shows a richer table primitive (sortable headers, alternating rows, hover states). Real ComparePlans is a much simpler static grid. **FE wins** — this is a marketing comparison block, not a data table. If you need a real data table later (Account / admin), build it separately and reference the preview.
