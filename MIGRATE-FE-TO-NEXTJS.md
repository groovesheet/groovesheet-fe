# Migrating the GrooveSheet frontend to Next.js

This is a brief for Claude Code. Open a session in `groovesheet-fe` and say:

> Read `MIGRATE-FE-TO-NEXTJS.md` and start at Phase 0.

Everything below is written to be followed top to bottom. Sections 1 and 2 are
the survey: what exists and why it is worth changing. Sections 3 onward are the
work. Section 5 is the list of things that are verified to break, each one
already paid for by somebody.

Written 2026-09-21, against commit `6736a8f`. Every number in section 1 was
measured, not estimated. Re-measure before trusting them.

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

## 2. Scope, and one thing to decide before starting

The goal is SEO. That means **Tier A and Tier B must be server-rendered**.
Tier C and Tier D can stay client-rendered forever and nobody loses anything;
inside Next they are just Client Components.

So this is not "rewrite 34,000 lines". It is:

- ~12 routes that need real server rendering and `generateMetadata`
- ~26 routes that move across roughly as-is
- one subsystem (23% of the code) that is quarantined behind `ssr: false`
- one genuinely structural change: auth

**The decision to make first:** whether auth moves to cookies now or later.
It is the single biggest blocker (see 5.3), and you can defer it, because
**every Tier B route fetches from unauthenticated endpoints.** `Explore.js` has
zero auth references. So Tier B can server-render with the existing localStorage
auth still in place, as long as the server never tries to read a session.

Recommended: **defer auth to Phase 5.** Get the SEO win first. Do not let the
hardest problem gate the most valuable one.

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

## 4. The plan

Each phase ends in something shippable and verifiable. Do not start the next
phase until the current one is green in production.

### Phase 0: Scaffold, and prove one page

Create `groovesheet-next/` beside the CRA app, as its own Vercel project. Do
**not** touch `src/`.

- Next 16, App Router, TypeScript, no Tailwind (see 5.6)
- One route, `/about`, ported by hand
- `generateMetadata` returning a real title and description

Done when: `curl` on the deployed preview returns `<h1>` text and a per-page
`<title>` in the HTML body, with JavaScript disabled.

This proves the pipeline end to end before any volume of work rides on it.

### Phase 1: Foundation

- Root layout: `<html lang>`, fonts (Hubot Sans, from Google Fonts), analytics
  (GA4 `G-LJ5P8PF3YH`, Ads `AW-18426875153`, GTM `GTM-PHXB57NW`, matching
  `public/index.html`)
- `src/styles/tokens.css` and any global CSS move into the root layout. Per-component
  `.css` files keep being imported by their components; the App Router allows this
- `Header` / `Footer`, as Client Components (they own dropdowns and a theme toggle)
- i18n via **next-intl** (see 5.5), with `app/[locale]/`
- Env: rename all 15 `REACT_APP_*` to `NEXT_PUBLIC_*`, and fix `PUBLIC_URL` (5.2)

Done when: `/about` and `/help` render server-side in all three locales with the
real site chrome.

### Phase 2: Tier A, the static marketing routes

Port the 8 Tier A routes. Server Components with `generateMetadata`. The
auth-aware ones (`Hero`, `StemSplitter`, `MidiConverter`, `Pricing`) keep their
auth as a small `'use client'` island inside an otherwise server-rendered page:
the marketing copy is what needs indexing, not the upload widget.

**Delete `scripts/prerender.mjs` and drop it from `npm run build`.**

Done when: all 8 return real HTML with distinct titles, and the Puppeteer step
is gone.

### Phase 3: The client-island harness

Before touching Tier B, prove the player works under Next in isolation. Use
`/preview1` or one of the `video2for*` routes, which nobody indexes.

- `next/dynamic` with `ssr: false`, inside a `'use client'` file (5.4)
- Confirm the vendored `osmd-extended` resolves under Next's bundler; `file:`
  dependencies plus a 17MB prebuilt `.min.js` are the risk
- Confirm `AudioContext` initialises only on user gesture, as now
- Run `player/transport.test.js` and `PreviewPanel/osmdPlaybackClock.test.js`

Done when: a score renders and plays in the Next app, and the two timing tests
pass. **If this phase goes badly, stop and reconsider the whole plan** rather
than pushing on into Tier B.

### Phase 4: Tier B, the actual payoff

`/explore`, `/explore/search`, `/explore/:songId`, `/u/:username`.

These become Server Components that fetch on the server, with `generateMetadata`
per song and per creator, and ISR. The player sits inside them as the Phase 3
island.

**Then delete the user-agent rewrites from `vercel.json` and the OG-page routes
from `seo.py`.**

Done when: `curl -A Googlebot /explore/<real-id>` returns the song title in an
`<h1>`, a per-song `<title>`, and JSON-LD. And the crutch is gone.

### Phase 5: Auth

Move to cookie-based `@supabase/ssr` (5.3). This unblocks server-rendering
anything behind a login, which matters for Tier C and for nothing else.

### Phase 6: Tier C and D

Straight ports as Client Components. No SEO work. This is volume, not risk.

### Phase 7: Cutover

- Point `groovesheet.net` at the Next project
- Keep `/blog*`, `/blog-media*`, `/internal*` and `/api/internal*` rewritten to
  `content-app` (or fold `content-app` in; see 6)
- Delete `src/`, `scripts/prerender.mjs`, `setupProxy.js`, `react-scripts`
- Watch Search Console for two weeks before deleting anything you cannot restore

---

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
since the repo's visible history begins. Verify early (Phase 3) that Next's
bundler resolves and tree-shakes it acceptably. If it fights you, the fallback
is loading it from `public/` via a `<script>` in the island, which is ugly but
contained.

---

## 6. Two open questions worth answering before Phase 7

**Does `content-app` fold in?** Once the main site is Next, the blog and portal
could become routes in it rather than a second project and a rewrite. That is
simpler to operate. It is also a migration inside a migration. Recommendation:
leave it separate until Phase 7 is done and stable, then decide with the benefit
of a working system.

**Does `seo.py` die completely?** Its sitemap section is still useful and is
independent of rendering. Its OG-page and prerender sections should go. Keep
`/seo/sitemap.xml`, delete `_og_page` and the UA rewrites.

---

## 7. Definition of done

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
- Rewrite anything under `src/player/`, `src/components/visualization/`,
  `src/components/PreviewPanel/` or `src/components/video/`. Wrap it, do not
  touch it
- Re-migrate `/blog*`. It already moved to `content-app`
- Server-render anything behind auth before Phase 5
- Trust `supabase.auth.getSession()` in server code, ever
- Deploy by CLI. This team is Git-only for production and fails silently;
  see `content-app/README.md`
