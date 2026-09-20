# content-app

The blog, the content pipeline that fills it, and the staff portal that
approves it. A Next.js 15 app that lives inside `groovesheet-fe` but builds and
deploys as **its own Vercel project**.

It exists as a separate app because `groovesheet-fe` is Create React App: a
client-rendered SPA cannot run scheduled functions, hold a Postgres connection,
gate a route behind a session, or serve a post as HTML a crawler can read. The
last one is the point. Before this, `/blog/<slug>` was submitted to Google in
the sitemap and served an empty `<div>`, because
`groovesheet-be/api-orchestrator/routes/seo.py` deliberately gives its
prerender to share bots and not to Googlebot.

## What runs

```
Vercel Cron, every 3 days             src/app/api/cron/content/route.ts
  1. scan    Google News queries, the music tech trade press, Reddit top of week
  2. rank    one LLM call scores the stories for relevance to GrooveSheet
  3. draft   the best story with readable source text becomes a post, written
             only from that text (DeepSeek has no web search), validated,
             revised once
  4. file    topics, audience, SEO keyword (from measured volumes), SEO title
  5. cover   the source article's own lead image, re-hosted to /blog-media
  6. social  LinkedIn, Facebook, Instagram and Pinterest captions from the post
  7. hold    status "review" in /internal/blog. Nothing is public yet.

A person, in /internal/blog/<id>
  8. edit in the rich text editor, with the full metadata panel
  9. Approve and publish: live on /blog at once, no deploy
 10. the URL is checked for a 200, then each ticked caption is sent
 11. /internal/social shows what is live, retries failures, takes down and reposts
```

## Where things are

| Piece | Where |
|---|---|
| Every business-specific value | `scripts/pipeline.config.json` |
| Feeds, relevance rules, cadence, score floor | same file, key `news` |
| Topics, audiences, bylines | same file, key `taxonomy` |
| Measured keyword volumes | `content/seo-keywords.json` |
| Scan, rank, draft, captions | `src/lib/content/news.ts`, `generate.ts` |
| Validator | `src/lib/content/validate.ts` |
| Approval, the only path to anything public | `src/lib/content/publish.ts` |
| Zernio client (LinkedIn, Facebook) | `src/lib/content/zernio.ts` |
| Upload-Post client (Instagram, Pinterest) | `src/lib/content/uploadPost.ts` |
| The posts that predate the pipeline | `src/lib/content/legacy.ts` |
| Rich text editor (TipTap, saves markdown) | `src/app/internal/_components/RichTextEditor.tsx`, `src/lib/editor/` |
| Image uploads, kept in Postgres | `src/app/api/internal/content/image/`, served at `/blog-media/<id>` |
| Blog listing, topic hubs, related posts | `src/lib/blogIndex.ts`, `src/app/blog/` |
| Tables | `src/lib/content/schema.sql` (apply once, idempotent) |
| Theme and shared classes | `src/app/theme.css`, `primitives.css`, `blog.css` |
| Rewrites to put this on the main domain | `vercel.rewrites.json` |

## Three sources, one blog

`src/lib/posts.ts` merges them and every public page reads the merged view:

1. **`content_drafts`** with `status = 'published'`: what the pipeline writes
   and a person approves.
2. **`blog_posts`**: the eleven posts written by hand before any of this
   existed, still live at their original URLs and still readable by the CRA
   app. They are read in place rather than copied, because copying would fork
   the data. `src/lib/content/legacy.ts` has the detail, and `LEGACY_TOPICS` in
   `src/lib/blogIndex.ts` files them under topics, since that table has no
   topic column.
3. **`content/posts/*.mdx`**: file posts. None exist yet. The path is kept
   because a file wins a slug clash, which is the escape hatch if a post ever
   has to be pinned in the repo.

Every database read is wrapped. With no `DATABASE_URL` the blog renders empty
and `next build` still passes.

## Running it locally

```bash
npm install
npm run dev          # http://localhost:3100
```

`.env.local` needs at minimum:

```
DATABASE_URL=postgresql://...        # transaction pooler, port 6543 on Supabase
DATABASE_URL_SESSION=postgresql://...# session pooler, port 5432, for migrations
INTERNAL_PASSWORD=...                # or INTERNAL_USERS, see below
CRON_SECRET=...
DEEPSEEK_API_KEY=...                 # or OPENROUTER_API_KEY
ZERNIO_API_KEY=...
UPLOAD_POST_API_KEY=...
```

`/internal/blog` names any that are missing, so start there.

Apply the schema once, through the **session** pooler:

```bash
npm run schema
```

That runs `scripts/apply-schema.mjs`, which reads `DATABASE_URL_SESSION` from
`.env.local`, prints the host it is about to change, and applies
`src/lib/content/schema.sql`. Pass a URL as an argument to override. It is
idempotent, so run it again after any change to that file.

`psql "$DATABASE_URL_SESSION" -f src/lib/content/schema.sql` does the same
thing if you have psql. It is not installed by default on macOS, which is why
the script exists: this app already depends on the `pg` driver, so it needs
nothing new.

Use the **session** pooler (port 5432), not the transaction pooler the app
runs on: DDL across one file needs a session that survives between statements.
On Supabase use a pooler host either way, because the direct host is IPv6 only
and Vercel cannot reach it.

**One credential per person** instead of a shared password:

```bash
node scripts/internal-user-hash.mjs '<password>'
# INTERNAL_USERS={"edward-zhang":"scrypt:...","..."}
```

The names come from `taxonomy.authors`, so the sign-in list and the byline list
cannot drift apart.

**Setting the secrets on Vercel**: `bash scripts/set-content-env.sh`. Run
`npx vercel link` inside this directory once first and pick the *content*
project, not the main one. `--social` sets only the two social keys from
`.env.local`; `--clipboard` takes the DeepSeek key from the clipboard and
generates the cron secret, so nothing is typed. A value only takes effect on
the next production deploy.

## Deploying

**Production deploys come from Git. `vercel deploy --prod` cannot work, by
policy, and it fails in the worst possible way.**

The Kelin Studio team has a deployment policy set to Git-only for production.
A CLI deploy is still accepted by the API, still creates a deployment record,
and then never builds. The CLI itself prints nothing and hangs indefinitely;
`vercel ls` shows the deployment as `UNKNOWN` with a 0ms build and no logs.
Nothing anywhere says why. Six deployments were burned on this before the
reason was found, and it is only visible in one field of the REST API:

```bash
TOKEN=$(python3 -c "import json,os;print(json.load(open(os.path.expanduser('~/Library/Application Support/com.vercel.cli/auth.json')))['token'])")
curl -sS "https://api.vercel.com/v13/deployments/<dpl_id>?teamId=team_sdgtRsTJTOsKrM2ahYMIsj0q" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import json,sys;print(json.load(sys.stdin).get('readyStateReason'))"
# CLI deployments are not allowed in production. Only Git deployments are allowed.
```

**Read `readyStateReason` first** for any deployment that is `BLOCKED` or
`UNKNOWN`. It is the only place the answer appears: not in `vercel logs`, not
in `vercel inspect`, not in the CLI's output.

Two things that look like the cause and are not, both checked:

- `live: false` on the project. Every project in the team has it, including
  the ones deploying fine. It does not mean paused.
- The team being blocked or over quota. The team is on Pro with no block, and
  34 other deployments were `READY` while all six of this project's were
  `BLOCKED`. When only one project is affected, it is that project's
  deployments being refused, not the team.

### How to deploy

Push to the production branch. That is the whole procedure.

```bash
git push origin feat/content-pipeline     # while that is the production branch
```

GitHub's webhook triggers the build. Nothing is uploaded from a laptop, so it
does not matter whose machine it runs on or what their network does.

**Redeploying with nothing to commit** is not `git commit --allow-empty`. That
is the usual advice and it does not work here: the Ignored Build Step below
asks whether the commit touched `content-app`, an empty commit did not, and
the build is correctly skipped. Redeploy the current production deployment
instead, which inherits its Git source and so satisfies the policy:

```bash
TOKEN=$(python3 -c "import json,os;print(json.load(open(os.path.expanduser('~/Library/Application Support/com.vercel.cli/auth.json')))['token'])")
TEAM=team_sdgtRsTJTOsKrM2ahYMIsj0q
SRC=$(curl -sS "https://api.vercel.com/v6/deployments?teamId=$TEAM&projectId=prj_yC0C22IWDpgjw1tkhNmk4o1BWM1s&limit=20&target=production" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import json,sys
for x in json.load(sys.stdin)['deployments']:
    if x.get('state')=='READY' and (x.get('meta') or {}).get('githubCommitSha'): print(x['uid']); break")
curl -sS -X POST "https://api.vercel.com/v13/deployments?teamId=$TEAM" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"deploymentId\":\"$SRC\",\"name\":\"groovesheet-content\",\"target\":\"production\",\"meta\":{\"action\":\"redeploy\"}}"
```

The Redeploy button in the dashboard does the same thing. Note the distinction
that costs the time: a redeploy of a Git deployment is a Git deployment, while
`POST /v13/deployments` with a fresh `gitSource` is not, and is refused with
the same "CLI deployments are not allowed" message.

### Project settings that make that work

Set once, via the API, and worth knowing if the project is ever recreated:

| Setting | Value | Why |
|---|---|---|
| Git repository | `groovesheet/groovesheet-fe` | Same repo as the CRA app |
| Root Directory | `content-app` | The app is a subdirectory; without this the build runs against the CRA app |
| Framework | `nextjs` | |
| Production Branch | `feat/content-pipeline` | Temporary. `main` has no `content-app/` yet |
| Ignored Build Step | `git diff --quiet HEAD^ HEAD -- .` | Both projects watch one repo. Without this, every push to the CRA app rebuilds this one for nothing. The command runs from the Root Directory, so `.` means `content-app` |

**When this branch merges to `main`, change the production branch back**, or
production silently keeps building from a branch nobody is updating:

```bash
TOKEN=$(python3 -c "import json,os;print(json.load(open(os.path.expanduser('~/Library/Application Support/com.vercel.cli/auth.json')))['token'])")
curl -sS -X PATCH "https://api.vercel.com/v9/projects/prj_yC0C22IWDpgjw1tkhNmk4o1BWM1s/branch?teamId=team_sdgtRsTJTOsKrM2ahYMIsj0q" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"branch":"main"}'
```

### The deployment builds, and every URL still 302s

A new Vercel project on a Pro team is created with SSO protection set to
`all_except_custom_domains`. This project has no custom domain, so that meant
everything, including the public blog, redirected to `vercel.com/sso-api`. The
build is green and the site is unreachable, which reads like a routing bug and
is not one.

It is set to `preview` here: preview deployments stay behind the team login,
production is public. That is what a public blog needs and it matches
`groovesheet-fe`, which has no SSO at all. Nothing is lost by it: `/internal`
and `/api/internal` are gated by `src/middleware.ts` and a signed session
cookie, not by Vercel.

It matters for the rewrite too. `www.groovesheet.net/blog` proxies to this
project's URL, so if that URL is behind SSO the rewrite proxies visitors into
a login wall.

```bash
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' https://groovesheet-content-kelin-studio.vercel.app/blog
# 302 https://vercel.com/sso-api?url=...   <- protection, not routing
```

### Checking a deployment actually works

The build going green is not the test. This is:

```bash
B=https://groovesheet-content-kelin-studio.vercel.app
curl -sS -o /dev/null -w 'blog        %{http_code}\n' $B/blog                       # 200
curl -sS -o /dev/null -w 'a post      %{http_code}\n' $B/blog/understanding-ghost-notes-detection  # 200
curl -sS -o /dev/null -w 'bad topic   %{http_code}\n' $B/blog/category/nope          # 404
curl -sS -o /dev/null -w 'portal      %{http_code}\n' $B/internal                    # 307 to /internal/login
curl -sS -o /dev/null -w 'cron naked  %{http_code}\n' $B/api/cron/content            # 401
```

The cron is registered per deployment, not per project. `GET /v1/projects/<id>/crons`
returns 404 because that endpoint does not exist; look at `crons` on the
deployment object instead:

```bash
curl -sS "https://api.vercel.com/v13/deployments/<dpl_id>?teamId=team_sdgtRsTJTOsKrM2ahYMIsj0q" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import json,sys;print(json.load(sys.stdin).get('crons'))"
# [{'path': '/api/cron/content', 'schedule': '0 1 */3 * *'}]
```

### A second reason not to deploy from the CLI

`.vercelignore` exists because without it the CLI uploads `.next` and
`node_modules`: 622MB against 89 files that matter. That produced its own
stall, separate from the policy one, and cost an hour of looking at the wrong
problem. Keep the file even though Git deploys do not read it, because someone
will eventually run `vercel deploy` for a preview.

## Things that will bite

**Dev mode cannot render a post.** `next-mdx-remote` throws inside `next dev`
for any MDX source, including `hello **world**`, and the failure surfaces as a
500 with `Cannot read properties of undefined (reading 'stack')`. `next build`
and `next start` are fine, as is production. Check `/blog/<slug>` with
`npm run build && npx next start`, not with `npm run dev`.

**The parent app leaks its config.** `groovesheet-fe` has a `postcss.config.js`
loading Tailwind and an `.eslintrc.js` extending `react-app`. Both tools search
upward, find them, and fail. `postcss.config.mjs` and `eslint.config.mjs` in
this directory exist to stop that search. Do not delete them because they look
empty.

**Topics are URLs.** Each `taxonomy.categories` entry is a hub at
`/blog/category/<slug>`, indexable once it holds a post. Relabel one freely;
changing a slug breaks its address.

**The hubs need `dynamicParams = true`.** With it false they are written once
at build and `revalidatePath` silently does nothing, so an approved post
appears on `/blog` and in the sitemap immediately while its own topic hub keeps
the old list until the next deploy. An unknown slug still 404s, from the
`notFound()` in the page.

**LLM regions.** OpenRouter, Anthropic and Gemini refuse requests from some
Vercel regions and the symptom is a timeout, not an error. The run routes pin
`preferredRegion = "iad1"`. Keep it.

**DeepSeek has no web search.** A draft may state only what is in the fetched
article. Stories with no readable source are skipped, by design.

**Google News links cannot be opened.** They are redirect shims and they are
most of the feed. `publisherUrls()` resolves the headline through Bing News
RSS. Without it the pipeline skips the best stories every time.

**Reddit rate-limits.** Its feeds are fetched one at a time and the scan
carries on without them. Four of five 429 from a home address; that is normal
and not worth chasing.

**Every query and feed in `news` was tested against the live source.** Some
obvious-looking ones are traps: a query naming Moises returns footballers and
baseball players, one naming Dorico, Sibelius or Finale returns composers and
sports fixtures, and `"music education"` returns local school-district news.
Notation coverage comes from the Scoring Notes feed instead. Test any new query
with curl before adding it.

**Upload-Post, Instagram**: the caption comes from the generic `title` field;
the documented `instagram_title` override is recorded and ignored, so the
caption is sent in both. It is asynchronous: the reply to `/upload_photos` is
often only a `request_id` and the outcome is on `/uploadposts/status`. Waiting
for it is what stops a refused post being recorded as published.

**Upload-Post, Pinterest** returns the pin's destination link as its `url`. The
pin itself is `https://www.pinterest.com/pin/<post_id>/`. Pinterest needs a
board to exist before anything can be pinned.

**Instagram and Pinterest posts cannot be deleted by API.** "Fix and repost"
reopens the row and tells the person to delete the old one by hand.

**Instagram aspect ratio** must be between 4:5 and 1.91:1. The default cover
`public/og.png` is 2400 by 1260, which is 1.9048, and passes narrowly. Keep any
replacement inside that range.

**Zernio will not re-run a cancelled post.** A repost is a fresh
`POST /posts`. The `x-request-id` header is the idempotency key, built from the
row id and its `updated_at`, so a double click cannot double post.

**Never announce a URL that is not live.** `isLive()` checks for a 200 before
any social send.

**`CREATE TABLE IF NOT EXISTS` never revisits a constraint.** Adding a platform
means dropping and re-adding the CHECK, as the bottom of `schema.sql` does.

**Old drafts miss new fields.** `completeDraft()` backfills captions, SEO
fields, topics and the cover when an unpublished draft is opened. Keep it when
adding a platform or a field.

**A Vercel function body is capped at 4.5 MB**, so image uploads are capped
at 4 MB.

**Cover images belong to their publisher.** A vendor's press image is made to
be reused; a magazine's own photography is not. The reviewer can replace the
cover in the editor before approving.

## Two sitemaps

`/sitemap.xml` on the main domain stays pointed at
`api.groovesheet.net/seo/sitemap.xml` and covers the whole site. This app
serves a second one at `/blog-sitemap.xml` covering the blog index, every post
from all three sources, and every topic hub that holds a post. Both get
submitted in Search Console. The backend one reads `blog_posts` only, so it
cannot see anything the pipeline publishes; that gap is why this one exists.

## Design

The portal keeps Volumet's information architecture, which is what it was
ported from, and none of its visuals. `src/app/theme.css` mirrors
`groovesheet-fe/src/styles/tokens.css` (it cannot import across apps, so when a
colour changes there, change it here). `primitives.css` holds the `gs-*`
classes the ported markup calls by name, plus the token bridge that lets 1,500
lines of ported `internal.css` keep working against GrooveSheet values.
`blog.css` is the public side. All of it follows
`groovesheet-fe/design-system/VISUAL_GUIDE.md`: dark by default, brand blue
`#012FA7`, Hubot Sans, layered 16/13/8 radii, 0.2s interactions, no decorative
gradients.

One deliberate departure: the visual guide's 1.2s theme crossfade is not
applied globally here. In a dense admin table a 1.2s hover reads as a dead
click.
