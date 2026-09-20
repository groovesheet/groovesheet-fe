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
psql "$DATABASE_URL_SESSION" -f src/lib/content/schema.sql
```

On Supabase, use the pooler hosts. The direct host is IPv6 only and Vercel
cannot reach it.

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
