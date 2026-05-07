# GrooveSheet Design System — Moved

This document has moved.

The current design system lives at **[`/design-system/`](../design-system/)** at the repo root.

## Where to look

- **Index + how to use:** [`design-system/README.md`](../design-system/README.md)
- **Visual + voice guide:** [`design-system/VISUAL_GUIDE.md`](../design-system/VISUAL_GUIDE.md)
- **Component status table:** [`design-system/components/_index.md`](../design-system/components/_index.md)
- **Per-component specs:** [`design-system/components/<Name>.md`](../design-system/components/) — each cites the real source file in `src/components/`
- **Token spec (reference):** [`design-system/tokens.reference.css`](../design-system/tokens.reference.css)
- **Runtime tokens:** [`../src/styles/tokens.css`](../src/styles/tokens.css)
- **Preview HTMLs:** [`design-system/preview/`](../design-system/preview/)

## For Claude / AI assistants

The design system is auto-loaded via the skill at [`.claude/skills/design-system/SKILL.md`](../.claude/skills/design-system/SKILL.md). When generating UI, the skill enforces the read-spec-then-mirror-real-component workflow.

## Why the move

The old single-document approach didn't scale to per-component specs, preview HTMLs, fonts, and logos. The 496-line original is preserved in git history if you need it (`git log -- docs/DESIGN_SYSTEM.md`).
