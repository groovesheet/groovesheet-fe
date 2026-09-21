# Migrating the GrooveSheet frontend to Next.js

This is a brief for a **parallel multi-agent rewrite**, not a phased hand
migration. It is written to be read by an orchestrator that will fan out work
packages to many agents at once.

**Read sections 0 to 3 before dispatching anything.** Section 0 is the
non-negotiable constitution every agent must follow. Section 4 is the work
packages and the one wave that must finish before the others start.

Written 2026-09-21, against commit `6736a8f`. Every number in section 1 was
measured, not estimated. Re-measure before trusting them.

---

## 0. Constitution: rules every agent follows

These exist because parallel agents cannot negotiate. Break one and another
agent's work breaks silently, usually at build time, sometimes in production.

1. **Own your files. Never edit another package's.** File ownership is declared
   per package in section 4. If you need a change in someone else's file, the
   change belongs in Wave 0's contracts instead, which means stopping and
   escalating rather than editing across the line.

2. **The two contracts are frozen after Wave 0.** `lib/api.ts` (47 exports,
   imported by 18 files) and `lib/auth` (9 exports, imported by 23 files) keep
   their existing names and signatures. Change the insides, never the surface.

3. **A server-rendered page is user-agnostic.** Anything that varies per user
   is a Client Component. This is not style: Tier B pages use ISR, and a cached
   page that embedded one user's state would serve it to everyone. See 5.9.

4. **Do not rewrite the player.** `src/player/`, `src/components/visualization/`,
   `src/components/PreviewPanel/`, `src/components/video/` and
   `src/components/TranscriptionResult/` are ported **verbatim** and wrapped.
   A diff that changes their internals is a bug unless it is fixing a named
   breakage from section 5.

5. **No `any`, no `@ts-ignore`, no skipped tests to make a build pass.** If it
   does not compile, the design is wrong. Say so.

6. **Every route you own gets a `generateMetadata` with a distinct title.**
   One shared title across 280 URLs is the exact defect being fixed.

7. **Do not deploy.** This team is Git-only for production and the CLI fails
   silently. One agent does the cutover, at the end. See `content-app/README.md`.

---

## 1. What exists today

### 1.1 Shape

| | |
|---|---|
| Framework | Create React App, `react-scripts` 5.0.1, React 18.2 |
| Size | 34,385 lines of JS across 156 files, 15,389 lines of CSS across 49 files |
| Routing | `react-router-dom` 7.9.6, **all 38 routes in one 252-line file**, `src/App.js` |
| Code splitting | None. No `lazy()`, no `Suspense`. Every route is in the initial bundle |
| Auth | Supabase JS v2, browser client, `persistSession` + `detectSessionInUrl`, session in **localStorage** |
| API | One module, `src/utils/api.js`, 47 exports, everything to `/api` |
| i18n | `react-i18next`, 299 keys, three locales (`en`, `zh-CN`, `zh-TW`) |
| Styling | 49 component-scoped `.css` files plus `src/styles/tokens.css` (171 lines). Tailwind is installed but barely used: about 65 utility classes in total |
| Tests | 7 files. Thin, but `player/transport.test.js` and `PreviewPanel/osmdPlaybackClock.test.js` cover real timing logic |
| Deploy | Vercel project `groovesheet-fe` (team `kelin-studio`), production branch `main`, root directory `.` |

### 1.2 The routes, grouped by what they need

This grouping drives the entire migration order. It is not alphabetical, it is
by how much each route stands to gain.

**Tier A: public, indexed, currently faked.** These are the routes the backend
sitemap advertises (`_STATIC_PATHS` in `groovesheet-be/api-orchestrator/routes/seo.py`).

```
/                    Hero.js                1291 LOC   heavy, auth-aware
/pricing             PricingPage.js
/stem-splitter       StemSplitter.js         825 LOC   auth-aware
/midi-converter      MidiConverter.js        964 LOC   auth-aware
/developers          ApiPage.js             1159 LOC   no auth
/about               About.js                          no auth
/changelog           Changelog.js                      no auth
/help                HelpSupport.js                    no auth
```

**Tier B: public, dynamic, the biggest prize.** Real content, one page per row
in a database, and today Google sees an empty div on every one of them.

```
/explore             Explore.js             no auth refs
/explore/search      SearchResults.js
/explore/:songId     song/SongDetail.js     1403 LOC, the largest component
/u/:username         CreatorProfile.js
```

These four are the reason to do this. They are also the two that already carry
a workaround: `vercel.json` sniffs the user agent and hands
`facebookexternalhit`, `Twitterbot` and friends a backend-rendered OG page for
`/explore/:id` and `/u/:username`. `seo.py` is explicit that this cannot be
extended to Google:

> Search engines (Googlebot/Bingbot) are deliberately **NOT** rewritten:
> serving them different content is cloaking; they execute JS.

That is correct, and it is why the crutch can never fix these pages. Only real
server rendering does.

**Tier C: logged in. No SEO value, migrate last or never.**

```
/account/history  /account/billing  /account/profile
/transcription-history/:workflowId  /billing/success  /sso-callback
```

**Tier D: internal, demo and campaign.**

```
/preview1  /video1  /video2forpiano  /video2fordrums  /video2forguitar
/video2forbass  /service-status  /signup/:code
```

**Already migrated.** `/blog`, `/blog/:slug` and `/blog/category/:slug` now
come from `content-app/`, a Next.js app served on this domain by rewrites.
**Do not migrate them again.** The CRA `Blog.js` and `BlogPost.js` still exist
in `App.js` but are unreachable in production. Delete them at cutover.

### 1.3 The player and notation subsystem

This is the part that must not break, and it is the part most likely to be
mishandled by someone treating this as a routine migration.

| Directory | LOC | Files |
|---|---|---|
| `src/components/video/` | 2,570 | 11 |
| `src/components/PreviewPanel/` | 1,688 | 10 |
| `src/player/` | 1,644 | 9 |
| `src/components/TranscriptionResult/` | 1,149 | 3 |
| `src/components/visualization/` | 748 | 6 |
| **Total** | **7,799 (23% of the app)** | **39** |

It depends on things that do not exist on a server:

- **OpenSheetMusicDisplay**, and not the published package: a **vendored fork**
  at `vendor/osmd-extended`, 17MB, wired in as `"osmd-extended": "file:vendor/osmd-extended"`.
  10 files import it. `MusicSheetView.js` and `PreviewPanel/OSMDViewer.js` are
  the two that matter.
- **Web Audio**: `AudioContext` in 4 files, all under `src/player/` and
  `src/components/video/videoSynth.js`. Plus `soundfont-player`.
- **Canvas**: `getContext` in 6 files.

**The good news, and it should shape your plan: none of this needs rewriting.**
Not one line. It becomes a client island behind `next/dynamic({ ssr: false })`.
The risk here is containment, not conversion. Treat any diff that rewrites
player internals as a mistake unless something specific forced it.

### 1.4 What the current SEO workarounds cost

Three separate mechanisms exist solely because CRA cannot server-render:

1. **`scripts/prerender.mjs`** (13KB, wired into `npm run build`). Boots
   headless Chromium after `react-scripts build` and bakes 11 marketing routes
   into static HTML. Its own header records the measurement that justifies this
   whole document:

   > Measured 2026-09-20: 280 URLs in the sitemap, **one distinct `<title>`
   > among them**, four indexed keywords.

2. **The user-agent rewrites** in `vercel.json` for `/explore/:id` and
   `/u/:username`, pointing at `seo.py`. Share bots only. Google excluded, on
   purpose, because the alternative is cloaking.

3. **`seo.py` itself**, in a different repo, in Python, rendering OG tags for a
   React app.

A successful migration **deletes all three**. That is the acceptance test, not
"the site still loads".

---

## 2. The auth question, answered

You asked whether this needs cookies, and whether `/explore` should require
sign-in to download scores. The second is already true. The first is more
subtle than it looks, so here is what the code actually does.

### 2.1 How downloads are gated today

`SongDetail.js` line 988 calls `downloadLibraryTrackZip(track.id, getToken)`,
which goes through `authenticatedFetch` in `src/utils/api.js`:

```js
const token = await getToken();
if (token) headers['Authorization'] = `Bearer ${token}`;
else throw new AuthError('Authentication required - no token available', 401);
```

So the gate is a **bearer token in a request header**, enforced by the backend
with a 401, and the UI opens the sign-in modal when there is no token. The
behaviour you want already exists.

### 2.2 Therefore: cookies are NOT required for that gate

A bearer token read from localStorage works identically in Next.js, because
the download is a **client-side action in a Client Component**. Nothing about
`/explore` requiring sign-in to download forces a cookie migration.

### 2.3 But do the cookie migration anyway, for different reasons

Cookies are required when the **server** needs to know who the user is:

- gating `/account/*` in `proxy.ts` before the page renders, instead of
  rendering a shell and redirecting in the browser
- server-rendering any personalised content
- removing the signed-in/signed-out flash on first paint

None of that is `/explore`. All of it is Tier C. Since this is a single
big-bang rewrite rather than a phased one, do it once, properly, now. Doing it
later means touching all 23 files that import `auth` a second time.

### 2.4 The rule that keeps both true at once

**`/explore`, `/explore/search`, `/explore/:songId` and `/u/:username` must
server-render without reading the session at all.** They are public, cached
with ISR, and identical for every visitor. The download button inside them is
a Client Component that reads auth in the browser and 401s if absent, exactly
as it does today.

Get this wrong and you either lose the SEO win (the page becomes dynamic and
per-user) or leak one user's state into another's cached page. See 5.9.

---

## 3. The trap: do not follow the official migration guide

This is the most important paragraph in this document.

Next.js publishes
["Migrating from Create React App"](https://nextjs.org/docs/app/guides/migrating/from-create-react-app).
It is current (v16.3.5, updated 2026-08-25) and it is **the wrong path for this
project**, verified 3-0 against the primary source.

Its stated goal is *"to get a working Next.js application as quickly as
possible... we'll treat your application as a purely client-side application
(SPA) without immediately replacing your existing router."* Concretely it tells
you to:

- set `output: 'export'` in `next.config`
- create `app/[[...slug]]/page.tsx`
- load the entire CRA app through `dynamic(() => import('../../App'), { ssr: false })`

Follow that and you end up with a client-rendered SPA plus a build-time
snapshot. **Which is exactly what `scripts/prerender.mjs` already does.** You
would spend weeks to arrive back where you started, having also disabled the
server features the whole exercise is for. The guide even warns that a static
export "does not currently support the useParams hook or other server features"
([vercel/next.js#54393](https://github.com/vercel/next.js/issues/54393)).

Vercel's own `cra-to-next-migration` agent skill prescribes the opposite: a
phased but complete routing conversion, no `[[...slug]]` shim.

**Use the guide for exactly two things:** the `NEXT_PUBLIC_` env rename (Step 9)
and the client-only entrypoint pattern (Step 7), which is the right shape for
OSMD and Web Audio leaf components. Ignore the rest.

---

## 4. Work packages

One wave blocks. Everything after it runs at once.

### Wave 0: contracts. One agent. Nothing else starts until this is merged.

This exists so that eight agents can work without talking to each other. Its
output is not features, it is **the interfaces everyone else codes against**.

Owns: `next.config.ts`, `tsconfig.json`, `package.json`, `proxy.ts`,
`app/layout.tsx`, `app/[locale]/layout.tsx`, `app/globals.css`, `lib/**`,
`components/chrome/**`, `components/ClientOnly.tsx`, `i18n/**`.

Deliver, in this order:

1. **Scaffold.** Next 16, App Router, TypeScript. No Tailwind (see 5.7).
2. **`lib/api.ts`.** Port all 47 exports from `src/utils/api.js`. Same names,
   same signatures. Delete the two `console.log` calls (see 5.10).
3. **`lib/auth/`.** Cookie-based `@supabase/ssr`. Must export the same 9 names:
   `supabase`, `AuthProvider`, `useUser`, `useAuth`, `useSignIn`, `useSignUp`,
   `useAuthActions`, `SignedIn`, `SignedOut`. Plus, new and server-only:
   `getClaims()` (never `getSession()`, see 5.3).
4. **`components/ClientOnly.tsx`.** The one sanctioned `ssr: false` wrapper.
   Every browser-only component goes through it, so the pattern is in one place
   and not reinvented 20 times.
5. **Root layout.** `<html lang>`, Hubot Sans, analytics (GA4 `G-LJ5P8PF3YH`,
   Ads `AW-18426875153`, GTM `GTM-PHXB57NW`, matching `public/index.html`).
6. **`app/[locale]/`** with next-intl, English unprefixed (see 5.5).
7. **Tokens and globals.** `src/styles/tokens.css` into the root layout.
8. **Header and Footer** as Client Components.
9. **Env.** Rename 15 `REACT_APP_*` to `NEXT_PUBLIC_*`; fix `PUBLIC_URL` in 11
   files (see 5.2).
10. **One proof route**, `/about`, server-rendered with `generateMetadata`.

Wave 0 is done when `curl` on `/about` returns an `<h1>` and a real `<title>`
**with JavaScript disabled**, in all three locales. Publish the contract file
paths to every other agent before they start.

### Wave 1: eight packages, all at once

Each owns a disjoint set of files. None edits `lib/**`.

| # | Package | Owns | Depends on |
|---|---|---|---|
| **P1** | **Player islands.** Port the 39 files verbatim into `components/player/**`. Wrap each browser-only entry in `ClientOnly`. Do not change internals. Export a stable prop contract for P2 and P5. | `components/player/**` | Wave 0 |
| **P2** | **Tier B: `/explore`, `/explore/search`, `/explore/:songId`, `/u/:username`.** Server Components, fetch server-side, `generateMetadata` per song and per creator, ISR. Download button is a Client island. **The highest-value package.** | `app/[locale]/explore/**`, `app/[locale]/u/**` | Wave 0, P1 |
| **P3** | **Tier A: the 8 marketing routes.** Server Components with metadata. Auth-aware ones keep auth as a small client island inside a server-rendered page. | `app/[locale]/(marketing)/**` | Wave 0 |
| **P4** | **Tier C: account routes.** Client Components. `/account/*` gated in `proxy.ts` using `getClaims()`. | `app/[locale]/account/**`, `app/[locale]/transcription-history/**`, `app/[locale]/billing/**` | Wave 0 |
| **P5** | **Tier D: demo, video, campaign.** `/preview1`, `/video1`, the four `video2for*`, `/service-status`, `/signup/:code`. Mostly client islands over P1. | `app/[locale]/(demo)/**`, `app/[locale]/signup/**` | Wave 0, P1 |
| **P6** | **Auth flows.** Sign-in modal, sign-up, sign-out, and `/sso-callback` as a route handler. **The OAuth flow must move from implicit to PKCE** (see 5.11). | `app/[locale]/sso-callback/**`, `components/auth/**` | Wave 0 |
| **P7** | **Shared components and CSS.** The ~40 remaining components nobody else owns, plus the 49 `.css` files. | `components/ui/**`, `components/**` not claimed above | Wave 0 |
| **P8** | **Verification harness.** Port the 7 tests. Write the section 7 checks as a runnable script. Run it against every other package's output. **Starts immediately, finishes last.** | `scripts/verify.mjs`, `**/*.test.ts` | Wave 0 |

### Wave 2: cutover. One agent. Only after P8 is green.

1. Point `groovesheet.net` at the Next project. Keep `/blog*`, `/blog-media*`,
   `/internal*` and `/api/internal*` rewritten to `content-app`.
2. **Delete `scripts/prerender.mjs`** and remove it from `npm run build`.
3. **Delete the user-agent rewrites** for `/explore/:id` and `/u/:username`
   from `vercel.json`.
4. **Delete `_og_page` and the OG routes** from `groovesheet-be`'s `seo.py`.
   Keep `/seo/sitemap.xml`.
5. Delete `src/`, `setupProxy.js`, `react-scripts`, and the CRA `Blog.js` /
   `BlogPost.js`.
6. Watch Search Console for two weeks before deleting anything unrecoverable.

Steps 2 to 4 are the acceptance test. If they cannot be done, the migration
did not achieve its purpose.

### What runs in parallel with what

```
Wave 0  ──────────────────────►  (blocks everything)
                                  │
        ┌─────────────────────────┼──────────────────────┐
        ▼                         ▼                      ▼
       P1 ──► P2                 P3, P4, P6, P7         P8 (continuous)
        └───► P5
                                  │
                                  ▼
                               Wave 2 (cutover)
```

P1 is on the critical path twice. Start it first and staff it best.

## 5. What breaks

Every item here was verified against primary sources or measured in this
repository. Do not rediscover them.

### 5.1 Environment variables

All 15 `REACT_APP_*` vars are read as literal `process.env.REACT_APP_X` member
expressions. **Zero** dynamic `process.env[...]` lookups. The rename is
mechanical and safe.

Both CRA and Next inline these at **build time**, so a changed value needs a
redeploy, not a restart. This already bit us once: see the note in
`groovesheet-repo-layout` memory about bundle hashes never matching.

### 5.2 `process.env.PUBLIC_URL` has no Next equivalent

Used in **11 files** (`NotFound.js`, `Element.js`, `HeroBackground.js`,
`PreviewDemo.js`, and more). Next serves `public/` at the root, so in almost
every case the fix is deleting the prefix: `${process.env.PUBLIC_URL}/images/x.png`
becomes `/images/x.png`. Check each one; a couple build URLs for `fetch`, not
for `src`.

### 5.3 Supabase auth: localStorage to cookies

`src/auth.js` configures the browser client with `persistSession` and
`detectSessionInUrl`, storing the session in localStorage. **A server component
cannot read localStorage**, so no route can server-render behind auth until this
moves to cookie-based `@supabase/ssr`.

The exported surface that must keep working: `supabase`, `AuthProvider`,
`useUser`, `useAuth`, `useSignIn`, `useSignUp`, `useAuthActions`, `SignedIn`,
`SignedOut`. Nine names, used across the app. Keep the names, change the
insides.

**The security rule, verbatim from Supabase's docs:**

> *Never* trust `supabase.auth.getSession()` inside server code such as Proxy.
> It reads the session out of the cookie without revalidating it.

Use `getClaims()`, which verifies the token signature. Anyone can forge a
cookie; only signature verification catches it. Getting this wrong is an auth
bypass, not a bug.

Note also `/sso-callback` and `detectSessionInUrl` interact with the cookie
flow. Test the full OAuth round trip, not just email sign-in.

### 5.4 `'use client'` does not stop server execution

The most common misunderstanding, and it will bite the player subsystem.

**Client Components are still prerendered during `next build`.** `'use client'`
marks a hydration boundary; it does not mean "browser only". A module touching
`window`, `document`, `AudioContext` or `canvas` at import time will still throw
during the build.

The fix is `next/dynamic` with `ssr: false`, **and that call must live inside a
file that is already `'use client'`**: in Next 15+, `ssr: false` is not allowed
from a Server Component. So the shape is:

```tsx
// ScoreView.tsx
'use client'
import dynamic from 'next/dynamic'
const OSMDViewer = dynamic(() => import('./OSMDViewer'), { ssr: false })
export default function ScoreView(props) { return <OSMDViewer {...props} /> }
```

About 20 files need this treatment. They are enumerated in 1.3.

### 5.5 i18n: next-intl, with one gap

`next-intl` is the better target than carrying `react-i18next` into RSC. Two
things to know:

- **The English locale is unprefixed here.** `buildLocalePath` returns the bare
  path for the default locale, so `/pricing` is English and `/zh-CN/pricing` is
  Chinese. Next's own i18n guide does not cover this: its example redirects every
  unprefixed path to a prefix. You need explicit routing config. `next-intl`
  supports per-locale custom prefixes (`localePrefix: { mode, prefixes }`), and
  an unlisted locale is used as-is.
- **`middleware.ts` is `proxy.ts` from Next 16 onward.** Both `next-intl` and the
  Next docs confirm the rename. Locale negotiation happens there.

The usual bundle-size argument for next-intl is weaker here than for a content
site, because the highest-traffic pages are necessarily Client Components
anyway. Choose it for the RSC story, not for the bundle.

### 5.6 Routing, and the `params` contract change

`<Routes>/<Route>` maps to the file system. Specifics:

- `path="*"` catch-alls become `[...slug]`; where the bare segment must also
  render, `[[...slug]]`
- `<Navigate to=... replace />` becomes `redirect()` in a Server Component. There
  are 3 of these (`/transcription-history`, `/history`, `/profile`)
- `useNavigate()` becomes `useRouter()` from `next/navigation`
- **`params` is now a Promise in Server Components and must be awaited.**
  `useParams` in Client Components is still synchronous. This asymmetry is the
  one that produces confusing errors

Do **not** consider a two-router strangler (`app/` beside `pages/`).
Cross-router navigation is a documented hard navigation with no prefetching, and
there is no Pages Router code here to preserve.

### 5.7 Styling

Low risk. 49 component-scoped `.css` files imported directly by their components
is allowed in the App Router. Global stylesheets must move to the root layout.

Tailwind is installed but used for roughly 65 classes. **Decide deliberately:**
either finish adopting it or drop it. Carrying a build dependency for 65 classes
is not worth it. Note `content-app` already made this call and ships plain CSS
with custom properties.

### 5.8 The vendored OSMD fork

`vendor/osmd-extended` is 17MB of prebuilt bundle referenced as a `file:`
dependency, `main: build/opensheetmusicdisplay.min.js`. It has not been touched
since the repo's visible history begins. P1 verifies on day one that Next's
bundler resolves and tree-shakes it acceptably, and reports immediately if not,
because P2 and P5 are both blocked behind it. If it fights, the fallback is
loading it from `public/` via a `<script>` in the island, which is ugly but
contained.

---

### 5.9 ISR plus per-user state is a cache leak, not a bug you will see

Tier B pages are cached and served to everyone. If a Server Component reads the
session and renders anything user-specific, **the first visitor's state is
cached and served to every subsequent visitor.** It will not show up in
development, where every request re-renders. It will not show up for the author,
who is always signed in. It shows up in production as one user seeing another's
state.

The rule from section 0 exists for this: a server-rendered page is
user-agnostic. Sign-in state, owned/not-owned, download buttons: all Client
Components, all reading auth in the browser.

P8 must test this explicitly: request a Tier B page signed in, then request it
signed out from a clean context, and diff the HTML. They must be identical.

### 5.10 `api.js` logs the bearer token to the console

`src/utils/api.js` line 43 logs a token prefix, and a few lines later:

```js
console.log('Request headers:', headers);
```

`headers` contains `Authorization: Bearer <full JWT>`. Every authenticated
request prints a usable token into the browser console. It is the user's own
token in their own console, so the severity is low, but it should not survive
the rewrite. Wave 0 deletes both lines when porting `lib/api.ts`.

### 5.11 The OAuth callback uses the implicit flow, which cannot be done server-side

`SSOCallback.js` handles two shapes. One is PKCE:

```js
await supabase.auth.exchangeCodeForSession(window.location.href)
```

The other reads `access_token` and `refresh_token` out of
`window.location.hash`. **A URL fragment is never sent to the server.** So the
hash path cannot become a route handler, and any cookie-based session
established from it has to be set by the browser after the fact.

P6 must move the flow to PKCE end to end, with the callback as a route handler
that exchanges the code and sets the cookie server-side. Then test the whole
round trip, per provider, not just email sign-in. Getting this wrong means
users appear signed in in one place and signed out in another.

## 6. Two open questions to answer before cutover

**Does `content-app` fold in?** Once the main site is Next, the blog and portal
could become routes in it rather than a second project and a rewrite. That is
simpler to operate. It is also a migration inside a migration. Recommendation:
leave it separate until the cutover is done and stable, then decide with the
benefit of a working system.

**Does `seo.py` die completely?** Its sitemap section is still useful and is
independent of rendering. Its OG-page and prerender sections should go. Keep
`/seo/sitemap.xml`, delete `_og_page` and the UA rewrites.

---

## 7. Definition of done, and how P8 checks it

- `tsc`, lint and a production build pass
- Every Tier A and Tier B route returns real HTML with a **distinct `<title>`**
  and a meaningful `<h1>` with JavaScript disabled
- `curl -A "Googlebot" <any /explore/:songId>` returns the song title in the body
- `scripts/prerender.mjs` is deleted and out of `npm run build`
- The user-agent rewrites are gone from `vercel.json`, and `_og_page` from `seo.py`
- A score renders and plays; `transport.test.js` and `osmdPlaybackClock.test.js` pass
- Sign in, sign out and the SSO round trip all work; no server code calls
  `getSession()`
- All three locales work, English still unprefixed
- Search Console shows more than one distinct title across the sitemap. That
  number was **1 of 280** on 2026-09-20 and is the measurement this whole
  exercise exists to change

---

## 8. Do not

- Follow the official CRA migration guide past Steps 7 and 9 (section 3)
- Start any Wave 1 package before Wave 0 has published the contracts
- Edit a file another package owns
- Rewrite anything under `src/player/`, `src/components/visualization/`,
  `src/components/PreviewPanel/` or `src/components/video/`. Wrap it, do not
  touch it
- Re-migrate `/blog*`. It already moved to `content-app`
- Server-render anything user-specific on a Tier B page (5.9)
- Trust `supabase.auth.getSession()` in server code, ever
- Deploy by CLI. This team is Git-only for production and fails silently;
  see `content-app/README.md`
