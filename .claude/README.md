# `.claude/` — groovesheet-fe

Project-scoped Claude Code config. Committed to the repo so the whole team gets the same agent setup.

## Layout

- `settings.json` — team-shared permissions (committed)
- `settings.local.json` — personal overrides, hooks, extra permissions (**gitignored**)
- `commands/` — repo slash commands (`/qa`, `/dev`, `/env`)
- `skills/design-system/` — the UI/design-system skill that auto-loads on UI work

## Conventions

- Anything secret (env values, hooks that touch personal paths) lives in `settings.local.json`.
- `settings.json` only contains shareable permission rules.
- New repo-wide slash commands go in `commands/` as `<name>.md` with a YAML front-matter.

## Reference

- Project memory: [`../CLAUDE.md`](../CLAUDE.md)
- Design system: [`../design-system/`](../design-system/)
