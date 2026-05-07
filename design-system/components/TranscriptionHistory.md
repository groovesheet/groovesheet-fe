# TranscriptionHistory

**Source of truth:** `src/components/TranscriptionHistory.js` (+ `TranscriptionHistory.css`)
**Visual reference:** —
**Status:** documented

The `/history` route page. Fetches the user's workflow list, resolves status for each, and renders a search-filterable list of `TranscriptionCard`s. Includes Header + Footer; this is a top-level page component.

## Anatomy

```
<page>
  <Header />
  <main>
    <button.back> ← Back
    <h1>Transcription History
    <div.search>
      <MagnifyingGlass icon />
      <input placeholder="Search by filename or instrument..." />
    {loading} → 3× <TranscriptionCardSkeleton />
    {error}   → error banner (with auth-error redirect to /)
    {workflows} → filtered <TranscriptionCard /> list per workflow
  <Footer />
```

## Variants & states

| State | Effect |
|---|---|
| `loading` | Renders 3 `TranscriptionCardSkeleton`s |
| `error` (regular) | Shows error message |
| `error.isAuthError` | Shows "Your session has expired" + `setTimeout(() => navigate('/'), 2000)` |
| Empty workflow list | Shows "no transcriptions yet" copy (read source for current text) |
| `searchQuery` filtering | Filters by filename or instrument name (case-insensitive) |

## Props

None — this is a page-level component mounted on `/history`.

## API integration

Uses `fetchWorkflowList(config.apiBaseUrl, getToken, signOut)` then per-id `fetchWorkflowStatus(...)` from `src/utils/api.js`. `signOut` is passed so 401/403 responses can sign the user out automatically (the `isAuthError` flag bubbles up from the API helpers). `resolveDisplayName` and `resolveAvailableOutputs` shape the data for `TranscriptionCard` props.

## Tokens used

`var(--color-foreground)`, `var(--color-muted-foreground)`, `var(--color-panel1)`, `var(--color-border)`, `var(--color-primary)`.

## Tone & copy rules

- Page title: **"Transcription History"** (Title Case)
- Search placeholder: sentence case ("Search by filename or instrument...")
- Auth-error message: sentence case, neutral ("Your session has expired. You have been logged out.")
- Back button: "← Back" with `ArrowLeft` Phosphor icon

## Do / Don't

- **Do** use `fetchWorkflowList` + `fetchWorkflowStatus` from `src/utils/api.js`. **Don't** add new API helpers inline; add them to `api.js` (the rule from CLAUDE.md).
- **Do** propagate auth errors via the `isAuthError` flag pattern — the API helpers already handle sign-out; the component only needs to handle UI redirect.
- **Do** render skeletons during initial load to keep layout stable.
- **Don't** poll the workflow list. Fetch once on mount; user can refresh by re-navigating.
- **Don't** call Clerk hooks directly. Use `'../auth'` (`useAuth`, `useClerk`).

## Drift from generated spec

No standalone preview HTML for the full history page. The constituent patterns (search input, list rows, skeletons, back button) appear separately in `preview/component-inputs.html`, `preview/component-list-row.html`, `preview/component-skeleton.html`, `preview/component-breadcrumbs.html`. The composition is FE-original.
