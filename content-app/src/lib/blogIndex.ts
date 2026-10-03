/* One index of everything the blog lists, whatever it is made of.

   Posts come from three places: hand-written route folders (the originals),
   .mdx files under content/posts/, and posts approved in the portal, which
   live in Postgres. The index page, the category hubs, related posts and the
   sitemap all read this file, so a post is filed under its topics once.

   Topics are `taxonomy.categories` in scripts/pipeline.config.json. */
import cfg from "../../scripts/pipeline.config.json";
import { allPostsAny, type Post } from "./posts";

export type BlogCard = {
  href: string;
  title: string;
  desc: string;
  image: string;
  alt: string;
  /** The small label over the title: Guide, Case study, Industry news. */
  meta: string;
  categories: string[];
  /** YYYY-MM-DD when known. Hand-written posts carry none. */
  date?: string;
};

export type Category = { slug: string; label: string; description: string };

export const CATEGORIES: Category[] = cfg.taxonomy.categories;

export function categoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

/* Hand-written React route posts under src/app/blog/<slug>/. Volumet had
   eleven; GrooveSheet has none, because its own originals live in the
   database (see content/legacy.ts) and are indexed through allPostsAny()
   instead. Add an entry here only if a post is ever written as a route. */
const STATIC_CARDS: BlogCard[] = [];

/* The posts that predate the pipeline carry no topic column, so they are
   filed here by slug. A post missing from this map falls back to "guides",
   which keeps it in the index and off every hub but one. */
const LEGACY_TOPICS: Record<string, string[]> = {
  "future-of-drum-transcription-ai-music-education": ["industry-news", "music-transcription"],
  "audio-to-sheet-music-in-seconds-ml-pipeline": ["music-transcription", "sheet-music-notation"],
  "understanding-ghost-notes-detection": ["music-transcription", "practice-and-learning"],
  "musicxml-pdf-or-midi-choosing-export-format": ["sheet-music-notation", "midi-and-daws"],
  "how-drummers-actually-use-transcriptions": ["practice-and-learning", "music-transcription"],
  "drum-teachers-cut-prep-time-80-percent": ["music-education", "practice-and-learning"],
  "drum-practice-feels-stuck-make-it-fun-again": ["practice-and-learning"],
  "learning-song-by-ear-vs-notation": ["practice-and-learning", "music-education"],
  "muscle-memory-deep-dive-drumming": ["practice-and-learning"],
  "steal-like-a-drummer": ["practice-and-learning", "production"],
  "bedroom-kit-to-first-gig-upgrade-path": ["practice-and-learning"],
};

/* .mdx posts predate topics and carry only a free-text `category` label. Filed
   by slug here, with the label as the fallback. */
const FILE_POST_TOPICS: Record<string, string[]> = {};

const LABEL_TOPICS: Record<string, string> = {
  guide: "guides",
  article: "guides",
  "industry news": "industry-news",
};

export function topicsOf(post: Post): string[] {
  const fm = post.frontmatter;
  if (fm.categories?.length) return fm.categories;
  if (FILE_POST_TOPICS[post.slug]) return FILE_POST_TOPICS[post.slug];
  if (LEGACY_TOPICS[post.slug]) return LEGACY_TOPICS[post.slug];
  const fromLabel = LABEL_TOPICS[(fm.category ?? "").toLowerCase()];
  return fromLabel ? [fromLabel] : ["guides"];
}

function cardOf(post: Post): BlogCard {
  const fm = post.frontmatter;
  return {
    href: `/blog/${post.slug}`,
    title: fm.title,
    desc: fm.summary || fm.description || "",
    image: fm.image || "/og.png",
    alt: fm.title,
    meta: fm.category || "Guide",
    categories: topicsOf(post),
    date: fm.publishedAt,
  };
}

/** Dated posts newest first, then the hand-written ones in their set order. */
export async function allCards(): Promise<BlogCard[]> {
  const dated = (await allPostsAny()).map(cardOf);
  return [...dated, ...STATIC_CARDS];
}

export async function cardsIn(category: string): Promise<BlogCard[]> {
  return (await allCards()).filter((c) => c.categories.includes(category));
}

/** Topics that have at least one post, in taxonomy order, with counts. */
export async function liveCategories(): Promise<(Category & { count: number })[]> {
  const cards = await allCards();
  return CATEGORIES.map((c) => ({
    ...c,
    count: cards.filter((k) => k.categories.includes(c.slug)).length,
  })).filter((c) => c.count > 0);
}

/** Up to `n` other posts sharing a topic with this one, closest topic first. */
export async function relatedTo(href: string, topics: string[], n = 3): Promise<BlogCard[]> {
  const cards = (await allCards()).filter((c) => c.href !== href);
  const scored = cards
    .map((c) => ({ c, score: topics.filter((t) => c.categories.includes(t)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map((x) => x.c);
}
