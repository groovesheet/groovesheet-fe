# GrooveSheet Frontend (groovesheet-fe)

> Agent memory for Claude Code. See [`.claude/`](./.claude/) for team-shared permissions and slash commands (`/qa`, `/dev`, `/env`). Personal overrides go in `.claude/settings.local.json` (gitignored).

## Stack
- React 18 + Create React App, React Router v7, Tailwind CSS + component CSS files
- Auth: Clerk (`@clerk/clerk-react`)
- Icons: `@phosphor-icons/react`, `lucide-react`, `react-icons`
- Deploy: Vercel (rewrites `/api/*` to Cloud Run)

## Key Entry Points
- `src/App.js` — App shell and all routes (`/`, `/history`, `/blog`, `/about`, `/sso-callback`)
- `src/index.js` — ClerkProvider wiring, requires `REACT_APP_CLERK_PUBLISHABLE_KEY`
- `src/utils/api.js` — SINGLE SOURCE OF TRUTH for all API calls. Always add new helpers here.
- `src/components/layout/Header.js` / `Footer.js` — Layout
- `src/setupProxy.js` — Dev proxy forwards `/api` to Cloud Run

## API Integration (always use these patterns)
- Use helpers from `src/utils/api.js`: `authenticatedFetch`, `uploadFileAuthenticated`, `fetchWorkflowList`, `fetchWorkflowStatus`
- All requests go to `/api` (not hardcoded URLs) — works in dev via proxy and prod via Vercel rewrite
- Always get `getToken` from `useAuth()` and pass to helpers
- Download links: `GET /api/workflow/download/{id}/{file_key}` (single file) or `/api/workflow/download/{id}` (ZIP)
- File keys from BE follow `{worker}_{instrument}_{type}` convention:
  - Demucs stems: `demucs_drums_stem`, `demucs_bass_stem`, `demucs_vocals_stem`, `demucs_other_stem`
  - ADToF: `adtof_drums_midi`, `adtof_drums_musicxml`
  - Transkun-v2: `transkun_v2_piano_midi`, `transkun_v2_piano_musicxml`
  - FCPE: `fcpe_bass_midi`, `fcpe_bass_musicxml`
  - BassUNet: `bassunet_jazz_bass_midi`, `bassunet_jazz_bass_musicxml`, `bassunet_jazz_bass_f0_csv`, `bassunet_jazz_bass_notes_csv`, `bassunet_jazz_bass_metadata_json`
  - midi2score (via orchestrator output_key_mapping): `midi2score_drums_musicxml`, `midi2score_piano_musicxml`, `midi2score_bass_musicxml`, `midi2score_jazz_bass_musicxml`

## Design System

**Source of truth: [`design-system/`](./design-system/)** — visual guide, per-component specs, tokens, preview HTMLs. Read these first when designing or scaffolding any UI:
- `design-system/README.md` — index + how to use
- `design-system/VISUAL_GUIDE.md` — tone, typography, color, motion, copy rules
- `design-system/components/_index.md` — component status table (shipped / gap)
- `design-system/components/<Name>.md` — per-component spec citing the real source file
- `design-system/tokens.reference.css` — full token spec (read-only reference; runtime is `src/styles/tokens.css`)

**Claude skill:** `.claude/skills/design-system/SKILL.md` auto-loads on UI work. It enforces the read-spec-then-mirror-real-component workflow.

**Rule:** when generated previews or specs disagree with the FE, the FE wins. Drift goes into the component spec, not into the code.

### High-signal styling notes
- Primary font: Hubot Sans
- Primary CTA blue: `#012FA7`; panel backgrounds: `#323033`
- Component-specific CSS files (e.g. `Hero.css`) — do not move styles to global
- High z-index modals/dropdowns: use `ReactDOM.createPortal(..., document.body)` with `z-index: 2147483647`
- Glass morphism is used **once** — only on the Hero upload card. Don't add it elsewhere.
- `docs/DESIGN_SYSTEM.md` is now a stub redirecting to `design-system/`. The 496-line original is preserved in git history.

## Auth & Gating
- Gate UI with `<SignedIn>` / `<SignedOut>` from `@clerk/clerk-react`
- Login entry points: call `LoginModal` via `onLoginClick` prop (see `Header.js`)
- SSO callback: `src/components/SSOCallback.js` at `/sso-callback`

## Commit Style
- Format: `fix(scope): description (#issue_number)` or `feat(scope): description`
- Commit after each logical change, not just at the end
- Reference `.github/instructions/git-commit.instructions.md` for full style guide

## Do Not
- Do not read `REACT_APP_API_URL` or `REACT_APP_API_BASE_URL` directly in new code — use `/api` + helpers
- Do not create markdown summary or plan docs unless explicitly requested
- Do not use Router v5 patterns (`<Switch>`) — this is Router v7 (`<Routes>`)
