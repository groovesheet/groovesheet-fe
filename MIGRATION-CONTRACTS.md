# Migration contracts (Wave 0 output)

Every Wave 1 agent reads this before writing a line. The brief is
`MIGRATE-FE-TO-NEXTJS.md`; this file is what Wave 0 actually built, and it is
frozen: if you need a change in anything listed under "Wave 0 owns", stop and
report it in `needsFromOthers` instead of editing it.

Stack: Next 16.3.5 (App Router, Turbopack), React 19.3, TypeScript 5.9
strict, next-intl 4, @supabase/ssr 0.12, vitest 5 (jsdom). No Tailwind.

Checks every agent runs on its own files (never `next build` / `next dev`,
never `npm install`):

```
npx tsc --noEmit -p /Users/edward/Github/GrooveSheet/gs-fe-next | grep '<your path>'
npx eslint <your files>
```

Wave 0 verified: `next build` passes, and with the server running,
`curl /about`, `/zh-CN/about`, `/zh-TW/about` each return
`<title>About | GrooveSheet</title>`, the `<h1>`, `<html lang>` for the
locale, a canonical and four hreflang links, with no Set-Cookie. Build output:
`/[locale]/about` is SSG for en, zh-CN, zh-TW.

---

## 1. Layout of the app

```
app/layout.tsx                 pass-through root (returns children)      Wave 0
app/not-found.tsx              last-resort 404 with its own <html>        Wave 0
app/globals.css                preflight + tokens + index.css + App.css   Wave 0
app/[locale]/layout.tsx        <html lang>, fonts, analytics, providers   Wave 0
app/[locale]/(marketing)/...   Tier A                                      P3
app/[locale]/explore/...       Tier B                                      P2
app/[locale]/u/...             Tier B                                      P2
app/[locale]/account/...       Tier C                                      P4
...
proxy.ts                       locale routing, session refresh, /account gate   Wave 0
next.config.ts                 next-intl plugin + rewrites                       Wave 0
i18n/routing.ts, i18n/request.ts                                                 Wave 0
messages/{en,zh-CN,zh-TW}.json 299 keys each                                     Wave 0
```

`<html lang>` lives in `app/[locale]/layout.tsx`, not `app/layout.tsx`,
because only the locale segment knows the locale (standard next-intl setup).
Every route you create lives under `app/[locale]/`.

The locale layout provides, to every page: `NextIntlClientProvider` (all
messages), `ThemeProvider`, `AuthProvider`, `LoginModalProvider` (renders the
one `<LoginModal>`), and `AppBoot` (attribution capture, PostHog/Clarity init,
pending preview and campaign claims; this replaces `src/index.js` and the
runners in `src/App.js`). Do not mount any of these again.

## 2. Page template (every route)

```tsx
// app/[locale]/(marketing)/pricing/page.tsx
import { setRequestLocale } from 'next-intl/server';
import { staticRouteMetadata } from '@/lib/seo/metadata';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return staticRouteMetadata('/pricing', locale);
}

export default async function PricingRoute({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);          // required, or the route turns dynamic
  return <PricingPage />;            // a Client Component island is fine
}
```

Rules:

- `params` is a Promise in Server Components; `await` it. Type it explicitly
  as above (the generated `PageProps<...>` globals only exist after a build).
- Call `setRequestLocale(locale)` first in every page and layout.
- Every route exports `generateMetadata` with a distinct title (constitution 6).
  Static routes: `staticRouteMetadata(path, locale)`; the titles live in
  `lib/seo/routeMeta.ts` (entries exist for `/`, `/stem-splitter`,
  `/midi-converter`, `/pricing`, `/developers`, `/about`, `/help`,
  `/changelog`, `/terms`, `/privacy-policy`, `/refund-policy`,
  `/business-information`; it throws for anything else). Data pages:
  `pageMetadata({ title, description, path, locale, image, ogType, noindex })`.
  Tier C and D pages pass `noindex: true`.
- Titles are bare; the layout template appends ` | GrooveSheet`.
- Tier A/B pages never read cookies, headers or the session (constitution 3,
  brief 5.9). Anything per-user is a Client Component reading `useAuth()`.
- Tier B dynamic routes: `export const revalidate = 300` (or similar),
  `export function generateStaticParams() { return []; }` plus
  `export const dynamicParams = true`, so nothing is prerendered from the
  rate-limited API at build time and each page is generated on first request.
- Private components: colocate in a `_components/` folder inside your route
  directory (e.g. `app/[locale]/explore/_components/SongCard.tsx`). Anything a
  second package needs goes through P7 (`components/**`) or P1
  (`components/player/**`).
- CSS: keep each component's `.css` file next to it and import it from the
  component (`import './Hero.css'`), as today. Global styles belong only in
  `app/globals.css` (Wave 0). No Tailwind: replace utility classes in markup
  you port with plain CSS in the component's own stylesheet (see how
  `components/chrome/AccountIcon.tsx` did it). Turbopack rejects invalid CSS
  that CRA tolerated (e.g. `!important` inside a comma list); fix by removing
  the declaration browsers were already dropping, with a comment.

## 3. Import map (CRA path -> Next path)

| src/ (CRA) | Next | Notes |
|---|---|---|
| `../auth` | `@/lib/auth` | same 9 names, same shapes |
| `../utils/api` | `@/lib/api` | same 47 exports |
| `../utils/libraryApi`, `creatorApi`, `previewApi`, `analytics`, `attribution`, `observability`, `airwallex`, `activeJob`, `notifications`, `queue`, `scrollToPricing`, `useBillingCatalog`, `musicXmlMetadata` | `@/lib/<same name>` | same exports, typed |
| `../hooks/useMediaQuery`, `useScrollPosition`, `useWorkflowPersistence`, `usePageMeta` | `@/lib/hooks/<same name>` | `usePageMeta` is for Tier C only |
| `../hooks` (index) | `@/lib/hooks` | |
| `../lib/constants`, `../lib/utils` | `@/lib/constants`, `@/lib/utils` | |
| `../config` | `@/lib/config` | default export, same fields |
| `../context/ThemeContext` | `@/lib/theme` | `ThemeProvider` is already mounted; use `useTheme()` |
| `../styles/breakpoints` | `@/lib/breakpoints` | |
| `../seo/routeMeta` | `@/lib/seo/routeMeta` | |
| `../components/explore/constants` | `@/lib/exploreConstants` | moved to lib because `creatorApi` needs it |
| `../mocks/libraryFixture.json` | `@/lib/fixtures/libraryFixture.json` | |
| `react-i18next` | `@/lib/i18n` | `useTranslation()` compat, see section 5 |
| `../i18n` (SUPPORTED_LOCALES, LOCALE_LABELS...) | `@/lib/i18n` (client) or `@/lib/locales` (anywhere) | |
| `../i18n/locale` `LocalizedLink`, `buildLocalePath`, `stripLocaleFromPath` | `@/lib/navigation` | |
| `../i18n/locale` `useLocalizedNavigate` | `@/lib/navigation-client` | same call shape |
| `../i18n/locale` `useLocale`, `rememberLocaleChoice`, `LOCALE_COOKIE` | `@/lib/i18n` | |
| `./layout/Header`, `./layout/Footer` | `@/components/chrome/Header`, `@/components/chrome/Footer` | default exports |
| `./LanguageSelector`, `./AccountIcon`, `./TrustBox` | `@/components/chrome/...` | |
| `./LoginModal` | `@/components/auth/LoginModal` (P6) | prefer `useLoginModal()` |
| `./ui/StatusMessage`, `./ui/SkeletonPanel`, `./ui/Button` | `@/components/ui/StatusMessage` etc. (P7) | default exports, same props |
| `react-router-dom` | see section 6 | |

Dropped on purpose: `src/utils/blog.js`, `Blog.js`, `BlogPost.js` (the blog is
the content app), `src/seo/useRouteMeta.js` and `RouteMeta` (replaced by
`generateMetadata`), `LocaleScope`/`LocaleSync` (next-intl and `proxy.ts`),
`setupProxy.js` (next.config rewrites). Unused in the CRA app and not ported
unless a package finds a caller: `TrackCard`, `TranscriptionCard`,
`TranscriptionCardSkeleton`, `VariantHoverWrapper`, `ComparePlans`, `Song`,
`song/Playbar`, `song/SongSidebar`, `song/Viewers`, `explore/FilterGroup`,
`explore/ResultRow` (check before skipping; some are only used by dead code).

## 4. The frozen contracts

### 4.1 `lib/api.ts` (browser)

47 exports, same names and parameter order as `src/utils/api.js`:

```
AuthError (class: status, isAuthError)
authenticatedFetch(url, options?, getToken, signOut?) -> Promise<Response>
uploadFileAuthenticated<T>(file, endpoint, getToken, baseUrl='/api', signOut?)
fetchWorkflowList<T=WorkflowListResponse>(baseUrl, getToken, signOut?, params?: {limit, offset})
apiPrefixForId(id) -> '/preview' | '/workflow'
downloadWorkflowFile(baseUrl, workflowId, fileKey, getToken) -> {blob, filename} | null
SCORE_INSTRUMENTS: string[]
downloadScorePdf(baseUrl, workflowId, getToken) -> {blob, filename} | null
fetchMusicXmlText(baseUrl, workflowId, getToken, fileKey='musicxml') -> string | null
fetchMidiArrayBuffer(baseUrl, workflowId, midiKey, getToken) -> ArrayBuffer | null
resolveInstrument, resolveWorkflowKind, resolveWorkflowType, resolveDescription,
resolveFileDisplayName, resolveDisplayName (workflow: Workflow)
scoreKeysFor(instrument) -> string[]
resolveAvailableOutputs(workflow) -> {instrument, transcription, midi, score}
fetchWorkflowStatus<T=Workflow>(baseUrl, workflowId, getToken, signOut?)
fetchAccountSummary<T>(baseUrl, getToken, signOut?)
fetchAccountUsageHistory<T>(baseUrl, getToken, params?, signOut?)
fetchAccountSettings<T>(baseUrl, getToken, signOut?)
fetchServiceStatus<T>(baseUrl='/api')
fetchBillingPlans<T=BillingCatalog>(baseUrl='/api')
fetchUserSubscription<T>(baseUrl, getToken, signOut?)
fetchCheckoutSession<T>(baseUrl, sessionId, getToken, signOut?)
createCheckoutSession<T=CheckoutSession>(baseUrl, plan, getToken, signOut?, currency?, clickIds?)
createBillingPortalSession, cancelSubscription (baseUrl, getToken, signOut?)
fetchCreatorProfile, updateCreatorProfile(baseUrl, patch, ...), checkUsernameAvailability(baseUrl, username, ...),
uploadAvatar(baseUrl, file, ...), updateAccountName(baseUrl, patch, ...), updateUserEmail(baseUrl, newEmail, ...),
deleteAccount, fetchPaymentMethod, exportAccountData (-> Blob)
updateWorkflowVisibility(baseUrl, workflowId, 'public'|'unlisted'|'private', getToken, signOut?)
updateWorkflowMetadata(baseUrl, workflowId, patch, getToken, signOut?)
deleteWorkflow(baseUrl, workflowId, getToken, signOut?, { deleteTrack? })
setPendingCampaignCode, getPendingCampaignCode, clearPendingCampaignCode
fetchCampaign<T>(baseUrl='/api', code, getToken?)
claimCampaign<T>(baseUrl, code, getToken, signOut?)
claimPendingCampaignIfAny(baseUrl, getToken)
```

Every JSON helper is generic over its result, defaulting to an interface in
`lib/types.ts` (`Workflow`, `BillingCatalog`, `LibraryTrack`, ...). Those
interfaces list the known fields and end in `[key: string]: unknown`, so an
unlisted field must be narrowed before use. If you know the shape, pass it:
`fetchAccountSummary<AccountSummary>(...)` with a local interface. Also
exported: `type GetToken = () => Promise<string | null>`, `type SignOut`.

Changed insides only: the token and header `console.log`s are gone (brief
5.10), as are the `/workflow/list` debug logs.

### 4.2 `lib/api-server.ts` (Server Components only, `import 'server-only'`)

Anonymous, cached reads of public data straight from `API_ORIGIN` (env,
default `https://api.groovesheet.net`), with a browser User-Agent for
Cloudflare. Never carries a user token.

```
serverFetchJson<T>(path, { revalidate=300, tags? }) -> T | null   (null on 404, throws ServerApiError otherwise)
getLibraryTrack(id, opts?) -> LibraryTrack | null                 (tag `track:<id>`)
getLibraryTracks({ q, cursor, limit }, opts?) -> LibraryTracksPage
searchLibraryTracksServer(SearchLibraryParams, opts?) -> LibraryTracksPage
getCreatorProfile(username, opts?) -> CreatorProfile | null        (anonymous view: is_owner/is_following false)
getBillingPlans(opts?) -> BillingCatalog | null                    (USD; for metadata copy only, visible prices use useBillingCatalog)
API_ORIGIN, DEFAULT_REVALIDATE, ServerApiError
```

`/library/tracks` is rate limited to 60/min per IP: never enumerate it in
`generateStaticParams`.

### 4.3 `lib/auth` (browser) and `lib/auth/server` (server)

`@/lib/auth` ('use client'), the 9 names with the CRA shapes:

```
supabase: SupabaseClient                     (@supabase/ssr browser client, cookies, flowType 'pkce', detectSessionInUrl false)
AuthProvider                                 (already mounted by the locale layout)
useUser()  -> { user: AppUser | null, isLoaded, isSignedIn }
useAuth()  -> { isLoaded, isSignedIn, sessionId, getToken }   getToken is stable across renders
useSignIn() -> { signIn: OtpFlow }   useSignUp() -> { signUp: OtpFlow }
useAuthActions() -> { signOut, setActive }
SignedIn, SignedOut
```

`OtpFlow` is the Clerk-shaped object the login modal drives
(`authenticateWithRedirect({ strategy, redirectUrl='/sso-callback',
redirectUrlComplete='/' })`, `create`, `prepareFirstFactor`,
`attemptFirstFactor`, `prepareEmailAddressVerification`,
`attemptEmailAddressVerification`, `update`). Also exported: `AppUser`,
`AUTH_NEXT_COOKIE`.

OAuth is PKCE now: `authenticateWithRedirect` stores the landing path in the
`gs_auth_next` cookie (`AUTH_NEXT_COOKIE`, same-site paths only, 10 minutes),
then redirects to the provider with `redirectTo = <origin>/sso-callback` (no
query string, so the Supabase allow-list still matches). The browser client
never exchanges the code itself (`detectSessionInUrl: false`). Email OTP and
magic links also point at `<origin>/sso-callback`.

**Contract for P6's `/sso-callback` route handler**: `GET` with `?code=`
(OAuth and PKCE magic links) or `?token_hash=&type=` (email links), exchange
server-side with `createSupabaseServerClient()` from `@/lib/auth/server`
(`exchangeCodeForSession(code)` / `verifyOtp`), read and clear the
`gs_auth_next` cookie, redirect to it (default `/`). `?error=` goes to `/`
with `?signin=1`. The legacy `#access_token=` hash flow cannot reach a route
handler; if P6 keeps a fallback for it, it is a client page.

`@/lib/auth/server` (`import 'server-only'`):

```
getClaims() -> Promise<JwtPayload | null>      verifies the JWT signature; claims.sub is the user id
createSupabaseServerClient() -> Promise<SupabaseClient>
```

Never `getSession()` on the server. Never call these from a Tier A/B page.

### 4.4 `proxy.ts`

- next-intl routing: `/x` is English (rewritten to `/en/x` internally),
  `/en/x` redirects to `/x`, `/zh-CN/x` and `/zh-TW/x` are prefixed. No
  Accept-Language detection and no locale cookie from next-intl.
- `/` with cookie `gs_locale=zh-CN|zh-TW` redirects to `/zh-CN` or `/zh-TW`
  (explicit choice, set by `rememberLocaleChoice`). vercel.json's
  country-based redirects are unchanged.
- Supabase session refresh via `getClaims()`, skipped entirely when the
  request has no `sb-*-auth-token` cookie (anonymous traffic and crawlers
  never hit Supabase and never get a Set-Cookie).
- `/account` and `/account/*` (any locale): signed-out visitors get a 307 to
  the locale home `/?signin=1&next=<original path>` (or `/zh-CN?...`).
  `LoginModalProvider` handles the landing: it opens the modal when
  `signin=1` is present, strips both params from the URL, and once the
  visitor is signed in (in-page OTP) routes them to `next`. For OAuth, P6's
  modal passes `useLoginModal().returnTo ?? '/'` as `redirectUrlComplete`.
  Verified with a forged `sb-*-auth-token` cookie: still redirected.
- Matcher excludes `/api`, `/blog`, `/blog-media`, `/internal`,
  `/content-assets`, `/_next`, `/_vercel` and any path with a dot.

### 4.5 `next.config.ts` rewrites (dev and prod)

`/api/internal/*`, `/blog`, `/blog/*`, `/blog-media/*`, `/internal`,
`/internal/*`, `/content-assets/*`, `/blog-sitemap.xml` go to
`https://groovesheet-content-kelin-studio.vercel.app`; `/api/*` goes to
`API_ORIGIN`; `/sitemap.xml` to `API_ORIGIN/seo/sitemap.xml`. These mirror
`vercel.json`, which is unchanged and still does the production routing.
Verified locally: `/blog` 200 (content app's title), `/internal/blog` 307 to
the content app's `/internal/login`, `/api/library/tracks` 200. The Header's
blog link is now a plain `<a href="/blog">` in every locale, because the
content app only serves the unprefixed path (the CRA link went to
`/zh-CN/blog`, which only worked because CRA rendered its own dead Blog page).

## 5. i18n

Messages: `messages/{en,zh-CN,zh-TW}.json`, the same 299 keys and nesting as
`src/i18n/locales/*/common.json`. Interpolation is ICU (`{year}`) instead of
`{{year}}`; call sites do not change. Dashes inside messages are stored as
`\u2013` / `\u2014` JSON escapes; the rendered text is unchanged.

Client Components:

```ts
import { useTranslation, useLocale } from '@/lib/i18n';
const { t, i18n } = useTranslation();
t('footer.copyright', { year });
t(['features.stems.card1.body', 'features.card1.body'], { size });   // fallback chain works
t('pricing.dismiss', { defaultValue: 'Dismiss' });                    // defaultValue works
i18n.language;                 // 'en' | 'zh-CN' | 'zh-TW'
i18n.changeLanguage('zh-TW');  // navigates to the same page in that locale, records gs_locale
const locale = useLocale();
```

A missing key returns the key (as i18next did). Server Components:

```ts
import { getT } from '@/lib/i18n-server';
const t = await getT(locale);   // same t
```

Adding keys: agents do not edit `messages/*.json` (Wave 0). Report new keys
in `needsFromOthers` with the English text and use `{ defaultValue }` until
then.

Locale constants anywhere (server-safe): `@/lib/locales` exports
`SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `Locale`, `isLocale`,
`LOCALE_LABELS`, `LOCALE_SHORT_LABELS`, `LOCALE_HTML_LANG`, `LOCALE_COOKIE`,
`rememberLocaleChoice`, `buildLocalePath`, `stripLocaleFromPath`.

## 6. Navigation (react-router replacements)

`@/lib/navigation` (server-safe; next-intl `createNavigation`):
`Link`, `redirect`, `permanentRedirect`, `usePathname`, `useRouter`,
`getPathname`, plus `LocalizedLink`, `buildLocalePath`, `stripLocaleFromPath`.
`@/lib/navigation-client`: `useLocalizedNavigate`.

All hrefs are the English path; the current locale's prefix is added for you.

| react-router | Next |
|---|---|
| `<Link to="/x">` | `<Link href="/x">` from `@/lib/navigation` (or keep `<LocalizedLink to>`) |
| `useNavigate()('/x')` | `useRouter().push('/x')` from `@/lib/navigation` |
| `useNavigate()('/x', { replace: true })` | `useRouter().replace('/x')` |
| `useNavigate()(-1)` | `useRouter().back()` |
| `useLocalizedNavigate()` | unchanged, from `@/lib/navigation-client` |
| `useLocation().pathname` | `usePathname()` from `@/lib/navigation` (locale already stripped) |
| `useLocation().search` / `useSearchParams` | `useSearchParams()` from `next/navigation` (wrap the reading component in `<Suspense>`, or the build fails for static routes) |
| `useParams()` in a Client Component | `useParams()` from `next/navigation` (synchronous) |
| route params in a Server Component | `const { id } = await params` |
| `<Navigate to="/x" replace />` | `redirect({ href: '/x', locale })` from `@/lib/navigation` in a Server Component |

## 7. Chrome, login modal, ClientOnly

- `@/components/chrome/Header` (default export, `'use client'`), props
  `{ onLoginClick?: () => void }`. Without `onLoginClick` it opens the shared
  modal. Pages render it inside their own container, as the CRA pages did.
- `@/components/chrome/Footer` (default export), no props.
- `@/components/chrome/LanguageSelector` (`{ compact?: boolean }`),
  `@/components/chrome/AccountIcon` (`{ compact?: boolean }`),
  `@/components/chrome/TrustBox` (`{ className? }`).
- `@/components/chrome/LoginModalProvider`: `useLoginModal()` returns
  `{ isOpen, openLoginModal, closeLoginModal, returnTo }` (`returnTo` is the
  `next` path from the /account gate, or null). Anything that took an
  `onLoginClick`/`onLoginRequired` prop from App.js gets `openLoginModal`
  from this hook instead (in the component, or in the page's client wrapper).
- `@/components/ClientOnly` (the only sanctioned `ssr: false`, brief 5.4):
  - `clientOnly(() => import('./OSMDViewer'), { fallback })` returns a
    component that never loads its module on the server. Call it at module
    scope in a `'use client'` file. Verified in the build: a module reading
    `window` at import time rendered its fallback server-side and mounted in
    the browser without errors.
  - `<ClientOnly fallback={...}>{children}</ClientOnly>` for markup that
    depends on the browser (the children's module is still evaluated on the
    server with this form).
  - `useIsClient()` hook.
- `@/lib/theme`: `useTheme()` -> `{ isDarkMode, toggleTheme }`. The server
  renders dark; an inline script applies a saved light choice before paint.

## 8. Stubs created by Wave 0 in other packages' directories

| File | Owner | Contract to keep |
|---|---|---|
| `components/auth/LoginModal.tsx` | P6 | named export `LoginModal` (and default), props `{ isOpen: boolean; onClose: () => void }`, `'use client'`. Replace the file wholesale with the port of `src/components/LoginModal.js` (562 lines, uses `useSignIn`, `useSignUp`, `useAuthActions`). |

No other stubs.

## 9. Environment variables

The 15 `REACT_APP_*` names are renamed to `NEXT_PUBLIC_*` in `.env.production`
and `.env.example` (and in every `lib/` reader). **The Vercel project env
needs the same rename at cutover (Wave 2; not done, do not touch Vercel):**

```
NEXT_PUBLIC_ADS_PURCHASE_LABEL     NEXT_PUBLIC_HUBSPOT_FORM_GUID
NEXT_PUBLIC_AIRWALLEX_ENV          NEXT_PUBLIC_HUBSPOT_PORTAL_ID
NEXT_PUBLIC_API_BASE_URL           NEXT_PUBLIC_NAME
NEXT_PUBLIC_API_URL                NEXT_PUBLIC_POSTHOG_HOST
NEXT_PUBLIC_CLARITY_ID             NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_ENABLE_ANALYTICS       NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_ENABLE_CHAT            NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_URL
```

New, server-only: `API_ORIGIN` (optional, default
`https://api.groovesheet.net`). Read `NEXT_PUBLIC_*` only as literal
`process.env.NEXT_PUBLIC_X` members (they are inlined at build time). P3's
About form reads `NEXT_PUBLIC_HUBSPOT_PORTAL_ID` / `_FORM_GUID` directly.
`next dev` does not read `.env.production`; developers need `.env.local`
with the Supabase pair.

## 10. `process.env.PUBLIC_URL` sites (brief 5.2)

Next serves `public/` at `/`; drop the prefix (`${process.env.PUBLIC_URL}/x`
becomes `/x`). Each owner fixes their own:

| # | File (CRA source) | Line | Use | Owner |
|---|---|---|---|---|
| 1 | `src/components/NotFound.js` | 50 | iframe `src` `/design/not-found.html` | P7 |
| 2 | `src/components/Element.js` | 41 | CSS background `/images/VIdeo.png` | P3 |
| 3 | `src/components/HeroBackground.js` | 27 | image URL `/images/hero-section/...` | P3 |
| 4 | `src/components/PreviewDemo.js` | 7-9 | fetch URLs `/sample-preview/*` | P5 |
| 5 | `src/components/CampaignPage.js` | 669 | image `/images/campaigns/<code>-bg.webp` | P5 |
| 6 | `src/components/video/Video2Drums.js` | 16 | `PUB` prefix for assets | P1 |
| 7 | `src/components/video/VideoDrumKit.js` | 20 | `/video-assets/drumkit` base | P1 |
| 8 | `src/components/video/Video2Tabs.js` | 20 | `PUB` prefix | P1 |
| 9 | `src/components/video/Video2.js` | 32 | fetch URL `/sample-preview/sample.musicxml` | P1 |
| 10 | `src/components/PreviewPanel/PreviewPanel.js` | 219 | iframe URL `/3d-piano-player/index.html?midiUrl=` | P1 |
| 11 | `src/components/video/Video2Instrument.js` | 15 | `PUB` prefix | P1 |

(13 occurrences in 11 files.) These are named breakages from brief 5.2, so
P1 may change these lines in the verbatim player port.

## 11. Tests

vitest 5, `vitest.config.mts`: jsdom, globals on (`describe/it/expect/
beforeEach` need no import), `@/` alias, picks up `**/*.test.{ts,tsx,js,jsx}`
outside `src/`. Port by replacing `jest.fn` with `vi.fn` and `jest.*` with
`vi.*`. `npm test` runs `vitest run`. Paths the 7 tests import from now:
`analytics.test` and `musicXmlMetadata.test` -> `@/lib/analytics`,
`@/lib/attribution`, `@/lib/musicXmlMetadata`; `i18n/claims.test` ->
`@/lib/constants` and `messages/*.json` (flat ICU files, not
`locales/*/common.json`), and it scans components for hardcoded sizes, so
point it at `app/` and `components/`; `player/*.test` and
`osmdPlaybackClock.test` -> P1's paths; `explore/resultsParams.test` -> P2's
path.

## 12. File ownership

| Package | Owns | Puts private components in | CRA sources it ports |
|---|---|---|---|
| **Wave 0** | `package.json`, lockfile, `tsconfig.json`, `next.config.ts`, `proxy.ts`, `eslint.config.mjs`, `vitest.config.mts`, `global.d.ts`, `.gitignore`, `.env.*`, `app/layout.tsx`, `app/not-found.tsx`, `app/globals.css`, `app/[locale]/layout.tsx`, `lib/**`, `i18n/**`, `messages/**`, `components/chrome/**`, `components/ClientOnly.tsx` | n/a | `auth.js`, `utils/*`, `hooks/*`, `lib/*`, `config.js`, `context/ThemeContext.js`, `styles/*`, `seo/routeMeta.js`, `i18n/*`, `index.js`, `App.js` shell, `layout/*`, `LanguageSelector`, `AccountIcon`, `TrustBox`, `explore/constants.js` |
| **P1** Player | `components/player/**` | `components/player/**` | `src/player/*`, `components/visualization/*`, `components/PreviewPanel/**`, `components/video/*`, `components/TranscriptionResult/*`, and the `components/song/*` viewers they import (`SongViewers`, `FretboardView`, `SpectrogramView`, `DrumGridView`, `FallingKeysView`, `PlaybackBar`, `InstrumentDropdown`, `icons`), plus `mocks/songDetailData.js` (`fmtTime`) |
| **P2** Tier B | `app/[locale]/explore/**`, `app/[locale]/u/**` | `app/[locale]/explore/_components/` (shared by `/u` too) | `Explore.js`, `explore/*` (except `constants.js`, now `@/lib/exploreConstants`), `song/SongDetail.js`, `creator/CreatorProfile.js` |
| **P3** Tier A | `app/[locale]/(marketing)/**` including `page.tsx` for `/`, `/pricing`, `/stem-splitter`, `/midi-converter`, `/developers`, `/about` (refine the Wave 0 proof), `/changelog`, `/help`, `/terms`, `/privacy-policy`, `/refund-policy`, `/business-information`, plus `app/[locale]/not-found.tsx` and `app/[locale]/[...rest]/page.tsx` (calls `notFound()`) | `app/[locale]/(marketing)/_components/` | `Hero`, `HeroBackground`, `Features`, `Pricing`, `PricingPage`, `Testimonials`, `FAQ`, `Element`, `StemSplitter`, `MidiConverter`, `ApiPage`, `About`, `Changelog`, `HelpSupport`, `PrivacyPolicy`, `TermsConditions`, `RefundPolicy`, `BusinessInformation`, `LegalPage.css` |
| **P4** Tier C | `app/[locale]/account/**`, `app/[locale]/transcription-history/**`, `app/[locale]/billing/**`, plus the redirect routes `app/[locale]/history/page.tsx` and `app/[locale]/profile/page.tsx` | `app/[locale]/account/_components/` | `TranscriptionHistory`, `TranscriptionDetail`, `AccountBilling`, `AccountProfile`, `BillingSuccess`; redirects `/transcription-history` -> `/account/history`, `/history` -> `/account/history`, `/profile` -> `/account/profile` |
| **P5** Tier D | `app/[locale]/(demo)/**` (`/preview1`, `/video1`, `/video2forpiano`, `/video2fordrums`, `/video2forguitar`, `/video2forbass`, `/service-status`), `app/[locale]/signup/**` | `app/[locale]/(demo)/_components/`, `app/[locale]/signup/_components/` | `PreviewDemo`, `ServiceStatus`, `CampaignPage`; the video pages wrap P1's `components/player/video/*` |
| **P6** Auth | `app/[locale]/sso-callback/**`, `components/auth/**` | `components/auth/` | `LoginModal` (replace the stub), `SSOCallback` (becomes a route handler, section 4.3) |
| **P7** Shared | `components/ui/**` and every `components/**` path not listed above | `components/<Name>/` | `ui/Button`, `ui/SkeletonPanel`, `ui/StatusMessage`, `ui/index`, `ProcessingJobs` (used by P3 and P4), `NotFound` (used by P2 and P3), `icons/*.svg`, and any other shared component a package reports |
| **P8** Verify | `scripts/verify.mjs`, `**/*.test.ts` | n/a | the 7 tests, brief section 7 |

P7 lands `components/ui/{StatusMessage,SkeletonPanel,Button}.tsx` first:
nearly every package imports them (StatusMessage has 30 importers,
SkeletonPanel 21, including P1's player files). Until then, a missing-module
error for those three paths in your `tsc` output is expected, not yours to fix.

## 13. Things that changed behaviour on purpose

- Tailwind removed. Its preflight reset is inlined at the top of
  `app/globals.css` so base styles do not shift; the one `@layer` rule
  (`.all-[unset]`) is plain CSS. Utility classes left in markup do nothing now.
- `src/index.css`'s `#root` rule is gone (no `#root` element).
- `useMediaQuery` is `useSyncExternalStore`-based: `false` on the server and
  during hydration, correct synchronously on client-side renders.
- The theme defaults to dark on the server; a saved light choice is applied
  by an inline head script before paint (the CRA app flashed dark first).
- AdSense is a plain async `<script>` in `<head>` (AdSense rejects
  next/script's `data-nscript`); GTM, gtag, Meta Pixel via `next/script`
  `afterInteractive`; Trustpilot `lazyOnload`; JSON-LD inline.
- `Header.css`: one invalid `transition` declaration removed (browsers were
  already ignoring it; Turbopack will not parse it).
