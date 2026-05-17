---
description: Run frontend quality checks (build + tests)
---

Run the FE quality gate before opening a PR:

1. `npm install` (only if `package.json` or `package-lock.json` changed)
2. `npm run build` — must succeed; React build is the canonical type/lint gate (eslint is disabled in build per CRA config, but compile errors still fail it)
3. `npm test -- --watchAll=false` — only if tests exist for the touched code

Report any failure with the offending file and the smallest fix.
