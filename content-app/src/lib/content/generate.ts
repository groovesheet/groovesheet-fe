/* One pipeline run: scan the industry, pick the story worth a post, draft the
   post, draft the social captions from it, and, when automatic publishing is
   on, put it live.

   Publishing itself still lives in ./publish.ts and still refuses anything the
   validator rejects. A run that drafts something the validator fails ends at
   status "review" in /internal/blog, with the reasons, exactly as every run
   did before. See autoPublishOn() below for the switches. */
import cfg from "../../../scripts/pipeline.config.json";
import measured from "../../../content/seo-keywords.json";
import { complete, extractJson, llmHasWeb } from "./llm";
import { scanNews } from "./news";
import { postSlugs } from "../posts";
import {
  finishRun,
  getDraft,
  insertDraft,
  insertMedia,
  socialForDraft,
  updateDraft,
  markNewsUsed,
  publishedDrafts,
  recentDraftTitles,
  runInProgress,
  scoreNews,
  slugTaken,
  startRun,
  upsertNews,
  upsertSocial,
  usedNewsTitles,
} from "./store";
import { SOCIAL_LIMIT, SOCIAL_PLATFORMS, type Draft, type Faq, type NewsItem } from "./types";
import { validateCaption, validateDraft, type Checkable } from "./validate";
import { approveDraft } from "./publish";

export type RunOutcome =
  | { outcome: "drafted"; draftId: number; title: string; detail: string }
  | { outcome: "published"; draftId: number; title: string; url: string; detail: string }
  | { outcome: "no-story" | "busy" | "failed"; detail: string };

const BLOG_MODELS: string[] = (process.env.CONTENT_BLOG_MODELS?.split(",") ?? cfg.generation.portalModels)
  .map((m) => m.trim())
  .filter(Boolean);
const SMALL_MODELS: string[] = [
  process.env.CONTENT_SOCIAL_MODEL?.trim() || cfg.generation.portalSocialModel,
  ...BLOG_MODELS,
];

const BUSINESS = [
  `${cfg.business.siteName}: ${cfg.business.description}`,
  `Market: ${cfg.business.market}. Site: ${cfg.business.baseUrl}.`,
  "What we do: a musician uploads an audio file and gets back editable notation. Drums, piano, bass and guitar each have their own transcription model. Output formats are PDF, MusicXML and MIDI, so a score opens in MuseScore, Sibelius, Dorico or Finale and the MIDI opens in any DAW.",
  "Two more tools on the same pipeline: a stem splitter that separates a mix into vocals, drums, bass and the rest, and an audio-to-MIDI converter. Separating first is usually what makes a transcription of a busy mix usable.",
  "Explore is a public library of transcriptions people have shared. There is a transcription API for developers.",
  "Who reads us: drummers, pianists, bassists and guitarists learning parts; music teachers and schools; producers and remixers; worship and session players; transcribers and arrangers doing the work by hand today.",
  "What we are not: we do not generate music, we do not sell licensed sheet music, and we are not a replacement for a good ear. Automatic transcription is a first draft that a musician edits.",
].join("\n");

function voiceBlock(): string {
  return [
    "VOICE",
    ...cfg.voice.tone.map((t) => `- ${t}`),
    `- Never use any of these: ${cfg.voice.bannedPhrases.join(", ")}.`,
    ...cfg.voice.bannedPatterns.map((p) => `- ${p.reason}`),
    "",
    "RULES THAT APPLY WHEN THE TOPIC COMES UP",
    ...cfg.voice.requiredDisclaimers.map((d) => `- ${d.text}`),
  ].join("\n");
}

/* ---------- 1. Rank ---------- */

type Ranked = { id: number; score: number; reason: string };

async function rank(candidates: NewsItem[]): Promise<Ranked[]> {
  const [used, drafted] = await Promise.all([usedNewsTitles(), recentDraftTitles()]);
  const list = candidates
    .map(
      (n) =>
        `[${n.id}] ${n.title} | ${n.source} | ${n.publishedAt?.slice(0, 10) ?? "undated"} | via ${n.feed}${
          n.summary ? ` | ${n.summary.slice(0, 220)}` : ""
        }`,
    )
    .join("\n");

  const { text } = await complete({
    models: SMALL_MODELS,
    maxTokens: 4000,
    temperature: 0.2,
    system: [
      "You are the news editor for a company blog. You decide which one industry story this week deserves a full post.",
      BUSINESS,
      "",
      "WHAT MAKES A STORY WORTH WRITING",
      ...cfg.news.relevance.map((r) => `- ${r}`),
      "- Stories surfaced from Reddit were upvoted by practitioners this week. Treat that as a popularity signal, but a Reddit thread itself is only worth a post when it points at something real.",
      "- A story we already covered, or a near duplicate of one, scores 0.",
      ...(llmHasWeb()
        ? []
        : [
            "- When the same story appears twice, once via Google News and once from a trade feed, score the trade feed copy higher and the other 0.",
          ]),
    ].join("\n"),
    user: [
      "ALREADY COVERED (do not pick these again):",
      [...used, ...drafted].map((t) => `- ${t}`).join("\n") || "- nothing yet",
      "",
      "CANDIDATES:",
      list,
      "",
      'Score the 10 strongest candidates from 0 to 100. Reply with JSON only: [{"id": 123, "score": 78, "reason": "one sentence on the angle we would take"}], best first.',
    ].join("\n"),
  });

  const ids = new Set(candidates.map((c) => c.id));
  return extractJson<Ranked[]>(text)
    .filter((r) => ids.has(Number(r.id)) && Number.isFinite(Number(r.score)))
    .map((r) => ({
      id: Number(r.id),
      score: Math.max(0, Math.min(100, Math.round(Number(r.score)))),
      reason: String(r.reason ?? "").slice(0, 400),
    }))
    .sort((a, b) => b.score - a.score);
}

/* ---------- 2. Read the source ---------- */

const UA = "Mozilla/5.0 (compatible; GrooveSheetNewsBot/1.0; +https://www.groovesheet.net)";

/** The lead image each fetched page declares (og:image), by page URL. */
const pageImages = new Map<string, string>();

const COVER_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/* The source article's own lead image, copied to /blog-media so the post, and
   the Instagram and Pinterest posts that reuse it, never depend on the
   publisher's server. Tiny files are skipped: they are logos and tracking
   pixels, not pictures. Returns null when there is nothing usable, and the
   draft keeps the default cover.

   The picture belongs to whoever published it. A vendor's press image is made
   to be reused; a magazine's own photography is not. The reviewer can swap the
   cover in the editor before approving. */
async function coverFrom(pageUrl: string): Promise<string | null> {
  if (!pageImages.has(pageUrl)) await readArticle(pageUrl);
  const src = pageImages.get(pageUrl);
  if (!src || !/^https?:\/\//.test(src)) return null;
  try {
    const res = await fetch(src, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const ext = COVER_TYPES[mime];
    if (!ext) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 15_000 || bytes.length > 4 * 1024 * 1024) return null;
    const id = await insertMedia({ mime, bytes, alt: "", by: "pipeline" });
    return `/blog-media/${id}.${ext}`;
  } catch {
    return null;
  }
}

async function readArticle(url: string): Promise<string> {
  if (/news\.google\.com/.test(url)) return "";
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
    if (!res.ok) return "";
    const html = await res.text();
    const og =
      html.match(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i)?.[1];
    if (og) {
      try {
        pageImages.set(url, new URL(og.replace(/&amp;/g, "&"), url).toString());
      } catch {
        /* A malformed address is no image. */
      }
    }
    return html
      .replace(/<(script|style|nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 7000);
  } catch {
    return "";
  }
}

function words(s: string): Set<string> {
  return new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(" ").filter((w) => w.length > 2));
}

/* Google News links are redirect shims: they cannot be read, and they are most
   of the feed, including usually the best story of the week. Bing News RSS
   carries the publisher's real address in a `url=` parameter, so the headline
   is looked up there and the result accepted only when its title shares most
   of its words with ours. Several outlets carry the same wire story, so the
   candidates are tried in turn until one can actually be read. */
async function publisherUrls(title: string): Promise<string[]> {
  const headline = title.replace(/\s+-\s+[^-]+$/, "").trim();
  try {
    const res = await fetch(
      `https://www.bing.com/news/search?q=${encodeURIComponent(headline)}&format=rss`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000), cache: "no-store" },
    );
    if (!res.ok) return [];
    const xml = await res.text();
    const want = words(headline);
    const out: string[] = [];
    for (const item of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
      const t = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "";
      const link = (item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "").replace(/&amp;/g, "&");
      const got = words(t);
      const shared = [...want].filter((w) => got.has(w)).length;
      if (want.size === 0 || shared / want.size < 0.6) continue;
      try {
        const real = new URL(link).searchParams.get("url") ?? link;
        if (/^https?:\/\//.test(real) && !/bing\.com|news\.google\.com/.test(real)) out.push(real);
      } catch {
        /* Not a URL. */
      }
    }
    return out.slice(0, 4);
  } catch {
    return [];
  }
}

type Readable = { url: string; text: string };

/** The story's own page when it can be read, else the same story at a publisher that can. */
export async function readStory(story: { url: string; title: string }): Promise<Readable> {
  const direct = await readArticle(story.url);
  if (direct.length >= MIN_ARTICLE_CHARS) return { url: story.url, text: direct };
  if (/news\.google\.com/.test(story.url)) {
    for (const url of await publisherUrls(story.title)) {
      const text = await readArticle(url);
      if (text.length >= MIN_ARTICLE_CHARS) return { url, text };
    }
  }
  return { url: story.url, text: direct };
}

const MIN_ARTICLE_CHARS = 800;

/* ---------- 3. Draft ---------- */

type DraftMeta = {
  title: string;
  slug: string;
  description: string;
  summary: string;
  faqs: Faq[];
  categories?: string[];
  industry?: string;
  seoKeyword?: string;
  seoTitle?: string;
};

type Parsed = Checkable & { categories: string[]; industry: string; seoKeyword: string; seoTitle: string };

const META_MARK = "===META===";
const BODY_MARK = "===BODY===";

function parseDraft(text: string): Parsed {
  const mi = text.indexOf(META_MARK);
  const bi = text.indexOf(BODY_MARK);
  if (mi === -1 || bi === -1 || bi < mi) throw new Error("Draft reply is missing the META or BODY marker");
  const meta = extractJson<DraftMeta>(text.slice(mi + META_MARK.length, bi));
  const body = text
    .slice(bi + BODY_MARK.length)
    .replace(/^```(?:markdown|md)?\s*\n/, "")
    .replace(/\n```\s*$/, "")
    .trim();
  return {
    title: String(meta.title ?? "").trim(),
    slug: String(meta.slug ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, cfg.validation.slugMaxChars)
      .replace(/-+$/, ""),
    description: String(meta.description ?? "").trim(),
    summary: String(meta.summary ?? "").trim(),
    faqs: Array.isArray(meta.faqs)
      ? meta.faqs.map((f) => ({ q: String(f.q ?? "").trim(), a: String(f.a ?? "").trim() }))
      : [],
    bodyMarkdown: body,
    // Only slugs that exist: the model does not get to invent a taxonomy.
    categories: [
      ...new Set([
        cfg.news.categorySlug,
        ...(Array.isArray(meta.categories) ? meta.categories : []).filter((c) =>
          cfg.taxonomy.categories.some((k) => k.slug === c),
        ),
      ]),
    ].slice(0, 3),
    industry: cfg.taxonomy.industries.some((i) => i.slug === meta.industry) ? String(meta.industry) : "",
    seoKeyword: String(meta.seoKeyword ?? "").trim().toLowerCase().slice(0, 80),
    seoTitle: String(meta.seoTitle ?? "").trim().slice(0, 60),
  };
}

async function linkMenu(): Promise<string> {
  const money = cfg.moneyPages.map((m) => `- [${m.label}](${m.path})`);
  let posts: string[] = [];
  try {
    posts = (await publishedDrafts()).slice(0, 15).map((d) => `- [${d.title}](/blog/${d.slug})`);
  } catch {
    /* The menu is a nicety. */
  }
  return [
    `MONEY PAGES (link at least ${cfg.validation.minMoneyPageLinks} different ones, in the body, where they help the reader):`,
    ...money,
    ...(posts.length ? ["", "OUR EARLIER POSTS (link when relevant):", ...posts] : []),
  ].join("\n");
}

function keywordMenu(): string {
  return [
    `MEASURED KEYWORDS (${measured.market}, monthly searches, Google Ads Keyword Planner and SE Ranking):`,
    ...measured.keywords.map((k) => `- ${k.keyword} (${k.volume})`),
  ].join("\n");
}

function draftSystem(): string {
  const v = cfg.validation;
  const wc = cfg.content.wordCount;
  return [
    `You write the ${cfg.business.siteName} blog. Each post takes one piece of industry news and explains what it means for working musicians, teachers and producers who want usable notation out of a recording.`,
    BUSINESS,
    "",
    "THE POST IS NOT A NEWS REWRITE. Report the news in a paragraph, then spend the rest on what we know that the press release does not: what it changes in practice, where it does not apply, what a client should ask for. If we cannot add a view, say less.",
    "",
    "STRUCTURE",
    ...cfg.news.requiredSections.map((s: string, i: number) => `${i + 1}. ${s}`),
    "",
    "FACTS",
    ...(llmHasWeb()
      ? [
          "- Use web search to verify every name, date, specification and figure against the original source before stating it. If you cannot verify a fact, leave it out.",
        ]
      : [
          "- You cannot look anything up. The ARTICLE TEXT in the brief is your only source for the news itself. State no name, date, specification, price or figure about the story that is not in it. If the text is thin, write a shorter news paragraph and spend the words on the practical analysis instead.",
          "- General trade knowledge (how transcription, stem separation, MIDI, notation formats and DAWs work) is fine. Anything about this specific announcement must come from the text.",
        ]),
    "- Link the original story inline, as a markdown link using the Link given in the brief, the first time you rely on it. End the body with a `## Sources` list of the links you used. Never invent a URL.",
    "- Never invent a quote, a statistic, a price or a client.",
    "",
    voiceBlock(),
    "",
    "FORMAT",
    `- ${wc.min} to ${wc.max} words, aim for ${wc.target}.`,
    "- Markdown only. No JSX, no HTML components, no imports. Every URL sits inside a markdown link, never bare.",
    "- Do not put an H1 in the body: the page renders the title. Start with a paragraph, use ## and ### for sections.",
    "- Internal links are site-relative paths, exactly as given in the menu.",
    `- title: ${v.titleMaxChars} characters at most, no site name in it.`,
    `- description: ${v.descriptionMinChars} to ${v.descriptionMaxChars} characters, the meta description.`,
    `- summary: ${v.summaryMaxChars} characters at most, one or two sentences shown under the title.`,
    `- slug: lowercase words and hyphens, ${v.slugMaxChars} characters at most.`,
    `- faqs: ${cfg.content.faqCount.min} to ${cfg.content.faqCount.max} real questions a client would ask about this news, answered in plain text.`,
    `- categories: one or two topic slugs from this list, the closest fit first: ${cfg.taxonomy.categories.map((c) => c.slug).filter((c) => c !== cfg.news.categorySlug).join(", ")}.`,
    `- industry: the one audience slug this matters to most, from: ${cfg.taxonomy.industries.map((i) => i.slug).join(", ")}. Empty string if it is general.`,
    "- seoKeyword: the one search phrase this post should rank for, lowercase. Choose it from MEASURED KEYWORDS in the brief when one honestly fits what the post is about: those are real monthly search volumes, and the highest-volume honest fit wins. Only when none fits, write your own two to five word phrase that a person would actually type. Never force an unrelated high-volume keyword onto the post.",
    "- Use the seoKeyword naturally in the first paragraph, in one ## heading and in the description. Do not repeat it beyond that.",
    "- seoTitle: the title as it should read in search results, 60 characters at most, with the seoKeyword near the front. It may differ from the on-page title.",
    "",
    "REPLY IN EXACTLY THIS SHAPE, NOTHING BEFORE OR AFTER:",
    META_MARK,
    '{"title": "...", "slug": "...", "description": "...", "summary": "...", "categories": ["..."], "industry": "...", "seoKeyword": "...", "seoTitle": "...", "faqs": [{"q": "...", "a": "..."}]}',
    BODY_MARK,
    "the markdown body",
  ].join("\n");
}

/* ---------- 4. Captions ---------- */

type Captions = { linkedin: string; facebook: string; instagram: string; pinterest: string };

async function captions(d: Checkable): Promise<Captions> {
  const ask = async (extra: string) => {
    const { text } = await complete({
      models: SMALL_MODELS,
      maxTokens: 3000,
      temperature: 0.7,
      system: [
        `You write ${cfg.business.siteName}'s social posts. Each one is written from a blog post we just published and sends readers to it.`,
        BUSINESS,
        "",
        voiceBlock(),
        "",
        "RULES",
        "- Only use facts that are in the blog post. Add no statistics or claims of your own.",
        "- It must read as written by a person in the trade: vary sentence length, no hype, no emoji bullets, no 'excited to share'.",
        "- No em dashes or en dashes anywhere.",
        "- Put the literal token {url} on its own line where the link belongs. Do not write any other URL.",
        "- linkedin: 120 to 220 words. A first line that states the news or the consequence plainly. Short paragraphs. What it means for people who transcribe, teach or produce music for a living. Close with the {url} line, then 3 to 5 lowercase hashtags on the last line.",
        "- facebook: 50 to 90 words, plainer and warmer, one idea, then the {url} line. At most 2 hashtags.",
        "- instagram: 60 to 120 words. It sits under an image and links are not clickable there, so do NOT include {url}. End with 'Link in bio.' on its own line, then 6 to 10 lowercase hashtags.",
        "- pinterest: a pin description of at most 450 characters, keyword-rich but readable, saying what the reader will learn. No {url} (the pin carries the link itself). 2 to 4 hashtags.",
        'Reply with JSON only: {"linkedin": "...", "facebook": "...", "instagram": "...", "pinterest": "..."}',
      ].join("\n"),
      user: `${extra}TITLE: ${d.title}\nSUMMARY: ${d.summary}\n\nBLOG POST:\n${d.bodyMarkdown.slice(0, 9000)}`,
    });
    const c = extractJson<Captions>(text);
    return {
      linkedin: String(c.linkedin ?? "").trim(),
      facebook: String(c.facebook ?? "").trim(),
      instagram: String(c.instagram ?? "").trim(),
      pinterest: String(c.pinterest ?? "").trim(),
    };
  };

  let c = await ask("");
  const problems = [
    ...validateCaption(c.linkedin, SOCIAL_LIMIT.linkedin).map((e) => `linkedin: ${e}`),
    ...validateCaption(c.facebook, SOCIAL_LIMIT.facebook).map((e) => `facebook: ${e}`),
    ...validateCaption(c.instagram, SOCIAL_LIMIT.instagram).map((e) => `instagram: ${e}`),
    ...validateCaption(c.pinterest, SOCIAL_LIMIT.pinterest).map((e) => `pinterest: ${e}`),
    ...(c.linkedin.includes("{url}") ? [] : ["linkedin: missing the {url} token"]),
    ...(c.facebook.includes("{url}") ? [] : ["facebook: missing the {url} token"]),
  ];
  if (problems.length) {
    c = await ask(`Your last attempt broke these rules, fix them all:\n- ${problems.join("\n- ")}\n\n`);
  }
  // The model is never trusted on the one rule a reader would notice.
  const scrub = (s: string) => s.replace(/\s*[\u2014\u2013]\s*/g, ", ");
  return {
    linkedin: scrub(c.linkedin),
    facebook: scrub(c.facebook),
    instagram: scrub(c.instagram),
    pinterest: scrub(c.pinterest).slice(0, SOCIAL_LIMIT.pinterest),
  };
}

/* ---------- The run ---------- */

/* A slug nothing else already answers to.
 *
 * Volumet asked the live site: HEAD the URL, and a 200 means taken. That check
 * cannot be used here, and the failure is silent and permanent. Until the
 * rewrites land, www.groovesheet.net is the CRA single-page app, which serves
 * its shell with status 200 for EVERY path under /blog. So every candidate
 * looked taken, the loop exhausted all 18 tries, and the fallback stamped
 * Date.now() into the URL of a post that will keep that URL forever. The first
 * real run produced exactly that.
 *
 * The three local sources are authoritative anyway, and between them they are
 * complete: content_drafts (every draft and published post), blog_posts (the
 * originals), and content/posts (file posts). Asking them needs no network and
 * cannot be fooled by a catch-all route. */
async function uniqueSlug(slug: string): Promise<string> {
  const base = slug || cfg.news.categorySlug;

  const taken = new Set<string>(postSlugs());
  try {
    const { legacySlugs } = await import("./legacy");
    for (const s of await legacySlugs()) taken.add(s);
  } catch {
    /* blog_posts unreachable. content_drafts is still checked below, and a
       clash with one of eleven known slugs is the lesser risk than refusing
       to draft at all. */
  }

  let candidate = base;
  for (let i = 2; i < 20; i++) {
    if (!taken.has(candidate) && !(await slugTaken(candidate))) return candidate;
    candidate = `${base}-${i}`.slice(0, cfg.validation.slugMaxChars);
  }
  /* Nineteen posts on one subject in one taxonomy. Dated, not stamped: a
     reader can at least read it. */
  return `${base.slice(0, 40)}-${new Date().toISOString().slice(0, 10)}`;
}

export async function runPipeline(trigger: "cron" | "manual"): Promise<RunOutcome> {
  if (await runInProgress()) {
    return { outcome: "busy", detail: "A run started in the last 15 minutes is still going." };
  }
  const runId = await startRun(trigger);
  try {
    const scan = await scanNews();
    const stored = await upsertNews(scan.items);
    const fresh = stored.filter((n) => n.usedDraftId === null);
    if (fresh.length === 0) {
      const detail = `No unused stories. ${scan.feedErrors.length} feed errors.`;
      await finishRun(runId, "no-story", detail, null);
      return { outcome: "no-story", detail };
    }

    const ranked = await rank(fresh.slice(0, 120));
    await Promise.all(ranked.map((r) => scoreNews(r.id, r.score, r.reason)));
    const floor = cfg.news.minScore;
    let best = ranked[0];
    let story = best && fresh.find((n) => n.id === best.id);
    let article = "";
    let sourceUrl = story?.url ?? "";
    if (best && story && best.score >= floor) {
      ({ url: sourceUrl, text: article } = await readStory(story));
      /* With no web search the article text is the only source. Walk down the
         ranking to the best story that can actually be read, as long as it
         still clears the floor. */
      if (!llmHasWeb() && article.length < MIN_ARTICLE_CHARS) {
        for (const r of ranked.slice(1, 8)) {
          if (r.score < floor) break;
          const candidate = fresh.find((n) => n.id === r.id);
          if (!candidate) continue;
          const read = await readStory(candidate);
          if (read.text.length >= MIN_ARTICLE_CHARS) {
            best = r;
            story = candidate;
            article = read.text;
            sourceUrl = read.url;
            break;
          }
        }
      }
    }
    if (!best || !story || best.score < floor || (!llmHasWeb() && article.length < MIN_ARTICLE_CHARS)) {
      const detail = `Scanned ${fresh.length} stories. Best scored ${ranked[0]?.score ?? 0} (floor ${floor})${
        !llmHasWeb() && ranked[0]?.score >= floor ? ", but no story above the floor had readable source text" : ""
      }. Nothing drafted.`;
      await finishRun(runId, "no-story", detail, null);
      return { outcome: "no-story", detail };
    }

    const menu = await linkMenu();
    const brief = [
      `TODAY: ${new Date().toISOString().slice(0, 10)}`,
      "",
      "THE STORY",
      `Headline: ${story.title}`,
      `Publisher: ${story.source}`,
      `Published: ${story.publishedAt?.slice(0, 10) ?? "unknown"}`,
      `Link: ${sourceUrl}`,
      story.summary ? `Feed summary: ${story.summary}` : "",
      `Why the editor picked it: ${best.reason}`,
      article ? `\nARTICLE TEXT (may be partial, verify against the source):\n${article}` : "",
      "",
      menu,
      "",
      keywordMenu(),
    ]
      .filter(Boolean)
      .join("\n");

    const system = draftSystem();
    let reply = await complete({ models: BLOG_MODELS, maxTokens: 14000, temperature: 0.6, web: llmHasWeb(), system, user: brief });
    let draft = parseDraft(reply.text);
    let validation = validateDraft(draft);

    /* One revision pass. The validator's output is precise enough to act on,
       and a second pass clears almost everything a first draft gets wrong. */
    if (validation.errors.length) {
      const fixed = await complete({
        models: BLOG_MODELS,
        maxTokens: 14000,
        temperature: 0.4,
        system,
        user: `${brief}\n\nYOUR PREVIOUS DRAFT:\n${reply.text}\n\nIt failed these checks. Return the full corrected post in the same shape, changing only what is needed:\n- ${validation.errors.join("\n- ")}`,
      }).catch(() => null);
      if (fixed) {
        try {
          const redraft = parseDraft(fixed.text);
          const revalidation = validateDraft(redraft);
          if (revalidation.errors.length < validation.errors.length) {
            reply = fixed;
            draft = redraft;
            validation = revalidation;
          }
        } catch {
          /* Keep the first draft. */
        }
      }
    }

    draft.slug = await uniqueSlug(draft.slug);
    const cover = await coverFrom(sourceUrl);
    const saved = await insertDraft({
      ...draft,
      category: cfg.news.category,
      image: cover ?? cfg.content.defaultImage,
      author: cfg.taxonomy.defaultAuthor,
      news: {
        url: sourceUrl,
        title: story.title,
        source: story.source,
        publishedAt: story.publishedAt,
      },
      validation,
      model: reply.model,
    });
    await markNewsUsed(story.id, saved.id);

    let socialNote = "captions drafted";
    try {
      const c = await captions(draft);
      for (const platform of SOCIAL_PLATFORMS) await upsertSocial(saved.id, platform, c[platform]);
    } catch (err) {
      socialNote = `captions failed: ${err instanceof Error ? err.message : err}`;
    }

    const base = `"${saved.title}" from ${story.source} (score ${best.score}). ${validation.errors.length} validation errors, ${socialNote}. ${scan.feedErrors.length} feed errors.`;

    /* Publish without waiting for a person, when that is switched on.

       Only a draft the validator passes clean goes out: approveDraft checks
       again and refuses on any error, so a run that drafts something broken
       falls back to holding it for review rather than failing. Warnings do not
       block, by design. They are style notes, and nothing would ever publish
       if they did. */
    if (autoPublishOn() && validation.errors.length === 0) {
      const result = await approveDraft(saved.id, AUTO_PUBLISH_BY, autoPublishSocial());
      if (result.ok) {
        const failed = result.social.filter((s) => !s.ok);
        const detail = `${base} Auto-published to ${result.url}. Social: ${
          result.social.length - failed.length
        } sent${failed.length ? `, ${failed.length} failed (${failed.map((f) => f.platform).join(", ")})` : ""}.`;
        await finishRun(runId, "published", detail, saved.id);
        return { outcome: "published", draftId: saved.id, title: saved.title, url: result.url, detail };
      }
      /* Held rather than lost: it is in /internal/blog with the reasons. */
      const detail = `${base} Auto-publish refused, held for review: ${result.errors.join("; ")}`;
      await finishRun(runId, "drafted", detail, saved.id);
      return { outcome: "drafted", draftId: saved.id, title: saved.title, detail };
    }

    await finishRun(runId, "drafted", base, saved.id);
    return { outcome: "drafted", draftId: saved.id, title: saved.title, detail: base };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await finishRun(runId, "failed", detail, null).catch(() => {});
    return { outcome: "failed", detail };
  }
}

/* ---------- Automatic publishing ----------

   A run publishes what it wrote, with no person in the loop. Switched on in
   pipeline.config.json; CONTENT_AUTO_PUBLISH overrides it at runtime with
   "1" or "0", so it can be stopped from the Vercel dashboard in the time it
   takes to redeploy, without a commit. CONTENT_PIPELINE_PAUSED=1 still stops
   the whole run earlier, which is the bigger hammer.

   The approval path itself is unchanged: /internal/blog can still publish,
   unpublish and retry by hand, and a draft the validator rejects still waits
   there for someone. */
const AUTO_PUBLISH_BY = "pipeline";

function envFlag(name: string): boolean | null {
  const raw = process.env[name];
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return null;
}

export function autoPublishOn(): boolean {
  return envFlag("CONTENT_AUTO_PUBLISH") ?? cfg.content.autoPublish.enabled;
}

function autoPublishSocial(): boolean {
  return envFlag("CONTENT_AUTO_PUBLISH_SOCIAL") ?? cfg.content.autoPublish.withSocial;
}

/** Rewrite the captions for a draft after the post itself has been edited. */
export async function regenerateCaptions(d: Checkable & { id: number }): Promise<void> {
  const c = await captions(d);
  for (const platform of SOCIAL_PLATFORMS) await upsertSocial(d.id, platform, c[platform]);
}

/* ---------- Backfill ----------
   Drafts outlive the code that wrote them. One written before a platform, a
   field or the cover step existed is missing it for good unless something goes
   back, so the review screen calls this when it opens a draft that is not
   live. It fills only what is empty and never overwrites a person's edit. */

export function draftGaps(d: Draft, platforms: string[]): string[] {
  return [
    ...SOCIAL_PLATFORMS.filter((p) => !platforms.includes(p)).map((p) => `${p} caption`),
    ...(d.seoKeyword ? [] : ["SEO keyword"]),
    ...(d.seoTitle ? [] : ["SEO title"]),
    ...(d.categories.length ? [] : ["categories"]),
    ...(d.image && d.image !== cfg.content.defaultImage ? [] : d.news.url ? ["cover image"] : []),
  ];
}

export async function completeDraft(id: number): Promise<string[]> {
  const d = await getDraft(id);
  if (!d || d.status === "published") return [];
  const existing = await socialForDraft(id);
  const have = existing.map((s) => s.platform as string);
  const gaps = draftGaps(d, have);
  if (gaps.length === 0) return [];
  const filled: string[] = [];

  if (SOCIAL_PLATFORMS.some((p) => !have.includes(p))) {
    const c = await captions(d);
    for (const p of SOCIAL_PLATFORMS) {
      if (!have.includes(p)) {
        await upsertSocial(id, p, c[p]);
        filled.push(`${p} caption`);
      }
    }
  }

  if (!d.seoKeyword || !d.seoTitle || d.categories.length === 0) {
    const { text } = await complete({
      models: SMALL_MODELS,
      maxTokens: 1500,
      temperature: 0.2,
      system: [
        "You file a finished blog post: its topics, its audience and its search fields. Reply with JSON only.",
        BUSINESS,
        `categories: one or two slugs from: ${cfg.taxonomy.categories.map((c) => c.slug).filter((c) => c !== cfg.news.categorySlug).join(", ")}.`,
        `industry: one slug from: ${cfg.taxonomy.industries.map((i) => i.slug).join(", ")}, or an empty string.`,
        "seoKeyword: from MEASURED KEYWORDS when one honestly fits the post, highest volume first. Otherwise your own two to five word phrase a person would type. Lowercase. Never force an unrelated keyword.",
        "seoTitle: 60 characters at most, the seoKeyword near the front when it reads naturally, no site name.",
        'Shape: {"categories": ["..."], "industry": "...", "seoKeyword": "...", "seoTitle": "..."}',
      ].join("\n"),
      user: `${keywordMenu()}\n\nTITLE: ${d.title}\nSUMMARY: ${d.summary}\n\nPOST:\n${d.bodyMarkdown.slice(0, 6000)}`,
    });
    const m = extractJson<DraftMeta>(text);
    const cats = (Array.isArray(m.categories) ? m.categories : []).filter((c) =>
      cfg.taxonomy.categories.some((k) => k.slug === c),
    );
    const isNews = Boolean(d.news.url);
    const categories = d.categories.length
      ? d.categories
      : [...new Set([...(isNews ? [cfg.news.categorySlug] : []), ...cats])].slice(0, 3);
    await updateDraft(id, {
      categories,
      industry: d.industry || (cfg.taxonomy.industries.some((i) => i.slug === m.industry) ? String(m.industry) : ""),
      seoKeyword: d.seoKeyword || String(m.seoKeyword ?? "").trim().toLowerCase().slice(0, 80),
      seoTitle: d.seoTitle || String(m.seoTitle ?? "").trim().slice(0, 60),
      author: d.author || cfg.taxonomy.defaultAuthor,
    });
    filled.push("search fields and topics");
  }

  if ((!d.image || d.image === cfg.content.defaultImage) && d.news.url) {
    const cover = await coverFrom(d.news.url);
    if (cover) {
      await updateDraft(id, { image: cover });
      filled.push("cover image");
    }
  }
  return filled;
}
