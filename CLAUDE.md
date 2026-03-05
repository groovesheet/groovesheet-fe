# GrooveSheet Frontend (groovesheet-fe)

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
- File keys from BE: `demucs_drums`, `demucs_bass`, `demucs_vocals`, `demucs_other`, `adtof_transcription`, `adtof_musicxml`, `bd_audio`

## UI/Styling Conventions
- Primary font: Hubot Sans
- Primary CTA blue: `#012FA7`; card backgrounds: `#323033`
- Component-specific CSS files (e.g. `Hero.css`) — do not move styles to global
- High z-index modals: use `ReactDOM.createPortal`
- Reference `docs/DESIGN_SYSTEM.md` for spacing and colors

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
