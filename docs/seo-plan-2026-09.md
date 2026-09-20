# GrooveSheet content SEO: measurement, fixes applied, and what to build next

Written 2026-09-11. Same method used for Volumet in August: crawl the live site
first-party, measure real demand against a keyword database before writing
anything, verify each candidate on a live SERP, then fix on-page and build only
what the data supports.

Keyword and SERP data: OpenRush (search index + live SERP), pulled 2026-09-11,
US database unless stated.

---

## 0. Where GrooveSheet started

| Measure | Value |
|---|---|
| Organic keywords (US search index) | **4** |
| Estimated organic traffic | **~3 visits/month** |
| Keywords in the top 10 | **0** |
| URLs in the sitemap | **280** (265 `/explore/*`, 11 `/blog/*`, 4 others) |
| Distinct `<title>` tags served | **1** |

That last row is the whole problem. Every URL on `www.groovesheet.net`: the
home page, `/stem-splitter`, `/pricing`, all 265 track pages: serves the same
16-word CRA shell with `<title>GrooveSheet</title>` and one generic
description. React Router swaps the view client-side, but only four components
(`Explore`, `SongDetail`, `TranscriptionDetail`, `CreatorProfile`) ever changed
the document title, so even a crawler that executes the bundle saw one page
repeated 280 times.

Three more findings from the same crawl:

- **`/features` and `/faq` are in the sitemap but are not routes.** Both are
  *sections* of the home page (`App.js` renders `<Features />` and `<FAQ />`).
  Requesting them returns the SPA's NotFound view under a 200: two soft 404s
  fed to Google every crawl.
- **`/stem-splitter`, `/midi-converter` and `/developers` were missing from the
  sitemap**: the pages the Google Ads campaign points at, carrying the two
  highest-volume terms in the category.
- **The bot rewrites in `vercel.json` do not cover search engines.** They match
  `facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp…`
  only, so Google and Bing get the empty shell, never the backend's `/seo/*`
  HTML.

---

## 1. The demand, measured

### Stem separation is the biggest market GrooveSheet is in: by 10×

| Keyword | Vol/mo | CPC | Comp |
|---|---|---|---|
| **stem splitter** | **9,900** | $1.62 | LOW |
| ai stem splitter | 4,400 | $2.13 | LOW |
| stem splitter free | 1,900 | $1.01 | LOW |
| free stem splitter | 1,300 | $1.19 | MED |
| stem splitter ai | 720 | $2.33 | LOW |
| ai stem splitter free | 590 | $1.26 | MED |
| audio stem splitter | 480 | $1.99 | LOW |
| best stem splitter | 390 | **$5.28** | MED |
| music / song stem splitter | 320 each | | |
| stem splitter online free | 260 | | |
| best ai / best free stem splitter | 210 each | **$4.24** | |
| vocal / online stem splitter | 170 each | | |

**~22,000 searches a month on non-brand phrasings**, plus a brand-modifier tail
worth roughly **7,000/mo** on its own: `logic pro stem splitter` 2,400,
`lalal ai stem splitter` 1,600, `loudly` 590, `bandlab` 480, `logic` 480,
`moises` 390, `fadr` 320, `ableton` 260, `sesh fm` 260, `audio.com` 260,
`uvr` 170, `gaudio studio` 170.

The word **free** appears in terms totalling about **4,650/mo**.

### Audio-to-MIDI is second

`audio to midi` **5,400** · `audio to midi converter` / `conversion software`
1,600 · `ableton audio to midi` 590 · `convert audio (file) to midi` 480.
Call it **~9,500/mo**, CPC under $1.20 throughout.

### The brand's own category is the smallest of the three

`audio to sheet music` 880 · `convert audio to sheet music online free` 390 ·
`audio to sheet music converter` 260 · `convert audio to sheet music` 260 ·
`transcribe audio to sheet music` 110 · `audio to sheet music ai` 50.
**~2,200/mo of forward intent.**

⚠️ Trap: `sheet music to audio` (320) and `convert sheet music to audio` (140)
are the **reverse** product: people who have notation and want playback. Do
not build for them.

### But "drum sheet music" is 8,100/mo: and 265 pages already point at it

`drum sheet music` / `drum set sheet music` / `sheet music for drum kit` and
nine other phrasings all resolve to the same **8,100/mo** cluster. The intent
is "find the notation for a song", which is exactly what `/explore/{track}`
serves. That is the scalable asset on this domain.

### SERP check: `stem splitter` (US, live)

| # | Result |
|---|---|
| 1 | vocalremover.org/splitter-ai |
| 2 | rysupaudio.com/pages/ai-stem-splitter: **a Shopify store** |
| 3 | acestudio.ai/stem-splitter |
| 4 | YouTube: "I Tested Every AI Stem Splitter So You Don't Have To" |
| 5 | **splitmysong.com**: a one-page indie tool |
| 6 | lalal.ai/stem-splitter |
| 7 | voice.ai/tools/stem-splitter |
| 8 | loudly.com/music/stem-splitter |
| 9 | bandlab.com/splitter |

**No AI Overview.** Every organic result is a *tool page* with the exact phrase
in the title, and most titles carry "Free". A Shopify page and a one-page indie
tool both outrank everything GrooveSheet has, which means this SERP is won on
page relevance, not domain strength. GrooveSheet already has the product and
the page: the page just never said what it was.

People-also-ask (use these verbatim as FAQ headings): *What is the purpose of
the stem splitter? · What is the best stem splitting tool? · Does stem splitter
use AI? · What is the best stem splitter in 2026?*

---

## 2. What was fixed (applied, `npm run build` green)

**`groovesheet-fe`**

| Change | File |
|---|---|
| Default `<title>` → "Audio to Sheet Music, Stems & MIDI \| GrooveSheet" | `public/index.html` |
| Organization + WebSite + SoftwareApplication JSON-LD, static so it survives without JS | `public/index.html` |
| `usePageMeta` now sets a self-referencing **canonical** and `og:url` from the live pathname, and restores document defaults on unmount instead of leaking the previous page's description | `src/hooks/usePageMeta.js` |
| Per-route titles and descriptions on **9 routes** that had none: home, `/stem-splitter`, `/midi-converter`, `/pricing`, `/about`, `/help`, `/blog`, `/changelog`, `/developers` | `App.js`, `components/*.js` |
| `/stem-splitter` and `/midi-converter` titles now lead with "Free", and the `/stem-splitter` `<h1>` contains the target phrase: "AI stem splitter: extract vocals & instruments from any song." | `components/StemSplitter.js` |
| Track pages retitled `"<song> by <artist> sheet music & MIDI"` (265 pages, aimed at the 8,100/mo notation cluster) with a description that says what you can actually do on the page | `components/song/SongDetail.js` |
| `robots.txt` disallows updated for the current router (`/account/`, `/profile`, `/transcription-history`, `/signup/`) | `public/robots.txt` |

**`groovesheet-be`**

| Change | File |
|---|---|
| `_STATIC_PATHS`: dropped the two soft 404s (`features`, `faq`), added `stem-splitter`, `midi-converter`, `developers` | `api-orchestrator/routes/seo.py` |

Titles were written to a ~46-character source budget, since `usePageMeta`
appends " | GrooveSheet" (14 chars) and Google truncates around 60.

---

## 3. What to build next, in priority order

1. **Prerender the marketing routes.** Client-only meta is a fix, not a
   solution: Google renders JS on its own schedule, and Bing, Perplexity and
   most AI crawlers largely do not. The ten static routes should be emitted as
   real HTML at build time (`react-snap` over the CRA build is the cheapest
   route; extending the `vercel.json` bot rewrite to Googlebot is the second
   cheapest but is dynamic rendering, which Google has deprecated). Everything
   below is worth more once this is done.
2. **Give `/stem-splitter` and `/midi-converter` their own page bodies.** Both
   currently render the *home page's* `<Features />`, `<Pricing />`,
   `<Testimonials />` and `<FAQ />`: the same words on three URLs. Each tool
   page needs its own explanation of what a stem is, what comes out, what the
   quality is, and its own FAQ built from the PAA questions above (add the keys
   to `i18n/locales/en/common.json`; `fallbackLng: 'en'` covers zh-CN/zh-TW
   until they are translated). Ship `FAQPage` JSON-LD with them.
3. ~~Decide on the word "free".~~ **Decided 2026-09-11: use it.** ~4,650
   searches a month carry the modifier and every competitor ranking above
   GrooveSheet puts it in the title, so `/stem-splitter` is now titled "Free AI
   Stem Splitter: Vocals, Drums & Bass" and `/midi-converter` "Free Audio to
   MIDI Converter: MP3 & WAV to MIDI". The free tier is a **10-second preview**
   with no processing minutes, so both meta descriptions say what free actually
   buys: "Preview any track free, then pay only for the minutes you process."
   The snippet does the qualifying, which turns a "free" search into a click
   that knows what it is getting instead of a bounce.
4. **A comparison page per competitor.** ~7,000/mo of brand-modifier volume:
   `lalal.ai`, `moises`, `fadr`, `bandlab`, `logic pro`, `ableton`, `UVR`. The
   honest angle is the one nobody else can copy: the competitors split stems,
   GrooveSheet splits stems **and writes the notation**.
5. **Make `/explore` work as a content asset.** 265 pages already exist and are
   already in the sitemap; they now carry notation-shaped titles. Next: make
   sure each is genuinely indexable after prerendering, add `MusicComposition`
   structured data, and cross-link tracks by instrument so the cluster has
   internal structure instead of 265 orphans.
6. **Blog: stop writing generally, write for the tail.** `how to remove vocals
   from a song`, `what is a stem in music`, `logic pro stem splitter`,
   `ableton audio to midi`: each maps to measured volume and each links down
   to a tool page.

---

## 4. What not to do

- **Do not lead with "music transcription software".** It is the brand's
  self-image, not the market: the sheet-music cluster is ~2,200/mo against
  ~22,000 for stem splitting. Stems are the front door; notation is the thing
  that makes people stay.
- **Do not target `sheet music to audio`.** Reverse intent, verified above.
- **Do not chase `guitar tab maker` (5,400/mo).** The Google Ads build already
  excluded it and added it as a negative: guitar runs stem separation only, no
  tab output. Ranking for it would earn refunds, not customers.
- **Do not add more URLs to the sitemap until they render server-side.** 280
  identical-looking pages is the current state; more of them is worse, not
  better.
