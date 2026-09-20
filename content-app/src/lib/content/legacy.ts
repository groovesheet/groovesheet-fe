/* The posts that were on the blog before this pipeline existed.

   GrooveSheet's blog has been database-backed since before the port: eleven
   posts live in the Supabase table `blog_posts`, written by hand and rendered
   until now by the CRA app at groovesheet-fe/src/utils/blog.js. This app took
   over /blog, so it has to serve them or eleven live, indexed URLs 404 on the
   day it ships.

   They are read here rather than copied into content_drafts. Copying would
   fork the data: the CRA app still has the reader and someone will edit a row
   there one day. One table, one copy, two readers.

   `blog_posts` columns, as that table actually is:
     id, slug, title, excerpt, body_md, cover_image_url, author,
     read_time_min, featured, size, published_at
   There is no topic column, hence LEGACY_TOPICS in ../blogIndex.ts. */
import { query } from "./db";

export type LegacyPost = {
  slug: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  coverImageUrl: string | null;
  author: string;
  featured: boolean;
  publishedAt: string;
};

type Row = {
  slug: string;
  title: string;
  excerpt: string | null;
  body_md: string | null;
  cover_image_url: string | null;
  author: string | null;
  featured: boolean | null;
  published_at: Date | string | null;
};

const FIELDS =
  "slug, title, excerpt, body_md, cover_image_url, author, featured, published_at";

/* Same visibility rule the CRA reader used: published_at set, and not in the
   future. A row scheduled for next week must not appear early here either. */
const VISIBLE = "published_at IS NOT NULL AND published_at <= now()";

function toPost(r: Row): LegacyPost {
  const at = r.published_at;
  const iso = at instanceof Date ? at.toISOString() : String(at ?? "");
  return {
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt ?? "",
    bodyMarkdown: r.body_md ?? "",
    coverImageUrl: r.cover_image_url || null,
    author: r.author || "GrooveSheet Team",
    featured: Boolean(r.featured),
    publishedAt: iso,
  };
}

export async function legacyPosts(): Promise<LegacyPost[]> {
  const rows = await query<Row>(
    `SELECT ${FIELDS} FROM blog_posts WHERE ${VISIBLE}
     ORDER BY published_at DESC LIMIT 500`,
  );
  return rows.map(toPost);
}

export async function legacyPostBySlug(slug: string): Promise<LegacyPost | null> {
  const rows = await query<Row>(
    `SELECT ${FIELDS} FROM blog_posts WHERE ${VISIBLE} AND slug = $1`,
    [slug],
  );
  return rows[0] ? toPost(rows[0]) : null;
}

/** Slugs already spoken for, so the pipeline cannot draft a post on top of one. */
export async function legacySlugs(): Promise<string[]> {
  const rows = await query<{ slug: string }>(`SELECT slug FROM blog_posts`);
  return rows.map((r) => r.slug);
}
