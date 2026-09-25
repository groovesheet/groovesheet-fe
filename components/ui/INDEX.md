# Shared components (P7)

Import map for the shared components other packages use. Every path is under
the `@/` alias. Default exports keep the CRA names and props, so a port only
changes the import line.

## `components/ui`

No `'use client'` on these three: they hold no state, so Server Components can
render them too. Only a Client Component can pass `Button` an `onClick`.

| Export | Import | Props | CRA source |
|---|---|---|---|
| `StatusMessage` (default and named) | `import StatusMessage from '@/components/ui/StatusMessage'` | `variant?: 'error' \| 'warning' \| 'info' \| 'success'` (default `'error'`), `title?: ReactNode`, `children?: ReactNode`, `className?`, `style?` | `src/components/ui/StatusMessage.js` |
| `SkeletonPanel` (default and named) | `import SkeletonPanel from '@/components/ui/SkeletonPanel'` | `count?: number` (1), `height?: number \| string` (96, number is px), `style?`, `className?`, `bare?: boolean` (no wrapper, for grids) | `src/components/ui/SkeletonPanel.js` |
| `Button` (default and named) | `import Button from '@/components/ui/Button'` | all `<button>` attributes, plus `variant?: 'primary' \| 'secondary' \| 'outline'`, `size?: 'small' \| 'medium' \| 'large'`; `type` defaults to `'button'` | `src/components/ui/Button.js` |
| barrel | `import { Button, SkeletonPanel, StatusMessage } from '@/components/ui'` | same | `src/components/ui/index.js` |

Types: `StatusMessageProps`, `StatusVariant`, `SkeletonPanelProps`,
`ButtonProps`, `ButtonVariant`, `ButtonSize`, from the same paths.

CRA call sites that used the named form (`import { StatusMessage } from
'./ui/StatusMessage'`, as `CampaignPage.js` and `CreatorProfile.js` did) keep
working unchanged.

## Other shared components

| Export | Import | Props | Notes |
|---|---|---|---|
| `ProcessingJobs` (default) | `import ProcessingJobs from '@/components/ProcessingJobs'` | `title?: string` ('Processing'), `style?: CSSProperties` | `'use client'`. Polls the caller's in-flight jobs every 10s; renders `null` until it finds one, which is also what the server renders, so a Server Component page may include it. Used by `/` (under the uploader) and `/stem-splitter` (P3). |
| `ProcessingCard` | `import { ProcessingCard } from '@/components/ProcessingJobs'` | `w: Workflow` | One job card. Used by the history page (P4). |
| `PROCESSING_STATES`, `isProcessing(w)` | `import { isProcessing, PROCESSING_STATES } from '@/components/ProcessingJobs'` | | Same status vocabulary the history page used. |
| `NotFound` (default and named) | `import NotFound from '@/components/NotFound'` | `title?: string`, `body?: string` (plain text), `onLoginClick?: () => void` | `'use client'`. Header, the design 404 artwork in an iframe (`/design/not-found.html`, `PUBLIC_URL` prefix dropped), Footer. Without `onLoginClick` the Header opens the shared login modal. For "Track not found" on `/explore/:songId` (P2) call `notFound()` for the real 404 status, or render `<NotFound title="Track not found" body="..." />` where a 200 is intended. |
| `VariantHoverWrapper` (default and named) | `import { VariantHoverWrapper } from '@/components/VariantHoverWrapper'` | `className?`, `componentVector?: string` ('/images/vector-2.svg'), `hover?`, `variant?` | Used by `Element.js` (P3). Tailwind utilities replaced by `VariantHoverWrapper.css`. |
| SVG icons | `@/components/icons/image.svg`, `vector.svg`, `vector-2.svg` | | Copied as-is. No CRA file imported them. |

## Routes P7 owns

| File | What it does |
|---|---|
| `app/[locale]/not-found.tsx` | Renders `<NotFound />` inside the locale layout for every `notFound()` under `[locale]`, including P3's `[...rest]` catch-all. Static `metadata`: title `Page not found` (the layout template appends ` \| GrooveSheet`), noindex. |
| `app/not-found.tsx` | Last-resort 404 outside the locale segment (paths `proxy.ts` skips). Own `<html>`, no providers, so no Header or Footer; shows the same artwork in a full-height iframe with a visually hidden `<h1>`. |

## Not ported, on purpose

No caller in the CRA app (see MIGRATION-CONTRACTS.md section 3):
`TrackCard`, `TranscriptionCard`, `TranscriptionCardSkeleton`, `ComparePlans`,
`Song`. Port on request if a package finds a caller.
