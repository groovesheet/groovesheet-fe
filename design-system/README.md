# GrooveSheet Design System

The canonical source of truth for visual design, voice, and component patterns in `groovesheet-fe`.

## What's in here

| File / folder | Purpose |
|---|---|
| `VISUAL_GUIDE.md` | Visual + voice guide. Tone, typography, color, dot grid, glass morphism, motion, copy rules. **Read this first.** |
| `tokens.reference.css` | Full CSS variable spec — colors, type scale, spacing, radii, motion, shadows. **Reference, not runtime.** Runtime tokens live in `src/styles/tokens.css`. |
| `components/_index.md` | Status table for every component pattern: shipped (`documented`), spec-only (`gap`), preview-only. |
| `components/<Name>.md` | Per-component spec — anatomy, variants, props, tokens used, copy rules, drift from preview. **Each one cites the real source file in `src/components/`.** |
| `preview/` | 50 standalone HTML mockups generated from the original design pass. Visual reference for components. **The FE wins on any conflict** — these are pictures, not implementations. |
| `assets/logos/` | Brand marks (SVG + PNG variants, light/dark). Production logos used by the FE live in `public/images/`. |
| `CONTRIBUTING.md` | The rule for keeping FE code and these specs in sync. |

## How to use it

**As a designer or human contributor:** start with `VISUAL_GUIDE.md`, scan `components/_index.md` for the pattern you need, open the matching `<Name>.md` and the linked source file.

**As Claude (or any AI assistant):** the skill at `.claude/skills/design-system/SKILL.md` auto-loads on UI work. It enforces a "read the spec, mirror the real component" workflow.

## The core rule

When current FE diverges from the generated `preview/` HTML, **the FE wins**. The drift is documented in each component spec under "Drift from generated spec." This system describes what's shipped — it doesn't redesign it.

Tokens listed in `tokens.reference.css` but missing from runtime `src/styles/tokens.css` are gaps to fill *deliberately*, not silently. Don't copy reference tokens into runtime without an actual use case.

## Links

- Runtime tokens: [`../src/styles/tokens.css`](../src/styles/tokens.css)
- FE conventions: [`../CLAUDE.md`](../CLAUDE.md)
- The skill: [`../.claude/skills/design-system/SKILL.md`](../.claude/skills/design-system/SKILL.md)
- Tailwind config: [`../tailwind.config.js`](../tailwind.config.js)
