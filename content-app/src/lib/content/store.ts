/* Every SQL statement the content pipeline runs. */
import { query } from "./db";
import type {
  Draft,
  DraftStatus,
  Faq,
  NewsItem,
  NewsRef,
  Run,
  SocialPlatform,
  SocialPost,
  Validation,
} from "./types";

type Row = Record<string, unknown>;

function iso(v: unknown): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function rowToDraft(r: Row): Draft {
  return {
    id: Number(r.id),
    slug: String(r.slug),
    title: String(r.title),
    description: String(r.description ?? ""),
    summary: String(r.summary ?? ""),
    category: String(r.category ?? ""),
    image: String(r.image ?? "/og.png"),
    faqs: (r.faqs as Faq[]) ?? [],
    bodyMarkdown: String(r.body_markdown ?? ""),
    status: r.status as DraftStatus,
    news: (r.news as Partial<NewsRef>) ?? {},
    validation: (r.validation as Partial<Validation>) ?? {},
    model: String(r.model ?? ""),
    author: String(r.author ?? ""),
    industry: String(r.industry ?? ""),
    categories: (r.categories as string[]) ?? [],
    seoKeyword: String(r.seo_keyword ?? ""),
    seoTitle: String(r.seo_title ?? ""),
    publishDate: r.publish_date
      ? r.publish_date instanceof Date
        ? r.publish_date.toISOString().slice(0, 10)
        : String(r.publish_date).slice(0, 10)
      : null,
    createdAt: iso(r.created_at) ?? "",
    updatedAt: iso(r.updated_at) ?? "",
    publishedAt: iso(r.published_at),
    approvedBy: (r.approved_by as string) ?? null,
  };
}

function rowToSocial(r: Row): SocialPost {
  return {
    id: Number(r.id),
    draftId: Number(r.draft_id),
    platform: r.platform as SocialPlatform,
    content: String(r.content ?? ""),
    enabled: Boolean(r.enabled),
    status: r.status as SocialPost["status"],
    zernioPostId: (r.zernio_post_id as string) ?? null,
    platformUrl: (r.platform_url as string) ?? null,
    error: (r.error as string) ?? null,
    updatedAt: iso(r.updated_at) ?? "",
    publishedAt: iso(r.published_at),
  };
}

function rowToNews(r: Row): NewsItem {
  return {
    id: Number(r.id),
    url: String(r.url),
    title: String(r.title),
    source: String(r.source ?? ""),
    feed: String(r.feed ?? ""),
    summary: String(r.summary ?? ""),
    publishedAt: iso(r.published_at),
    fetchedAt: iso(r.fetched_at) ?? "",
    score: r.score === null || r.score === undefined ? null : Number(r.score),
    reason: String(r.reason ?? ""),
    usedDraftId: r.used_draft_id ? Number(r.used_draft_id) : null,
  };
}

/* ---------- News ---------- */

export type NewsInput = NewsRef & { feed: string; summary: string };

/** Inserts what is new and returns every row for the given URLs. */
export async function upsertNews(items: NewsInput[]): Promise<NewsItem[]> {
  if (items.length === 0) return [];
  for (const n of items) {
    await query(
      `INSERT INTO content_news (url, title, source, feed, summary, published_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (url) DO NOTHING`,
      [n.url, n.title, n.source, n.feed, n.summary, n.publishedAt],
    );
  }
  const rows = await query<Row>(`SELECT * FROM content_news WHERE url = ANY($1)`, [
    items.map((n) => n.url),
  ]);
  return rows.map(rowToNews);
}

export async function scoreNews(id: number, score: number, reason: string): Promise<void> {
  await query(`UPDATE content_news SET score = $2, reason = $3 WHERE id = $1`, [
    id,
    score,
    reason,
  ]);
}

export async function markNewsUsed(id: number, draftId: number): Promise<void> {
  await query(`UPDATE content_news SET used_draft_id = $2 WHERE id = $1`, [id, draftId]);
}

export async function recentNews(limit = 30): Promise<NewsItem[]> {
  const rows = await query<Row>(
    `SELECT * FROM content_news
     WHERE fetched_at > now() - interval '14 days'
     ORDER BY score DESC NULLS LAST, published_at DESC NULLS LAST
     LIMIT $1`,
    [limit],
  );
  return rows.map(rowToNews);
}

/** Titles of stories already written up, so the ranker can steer away from repeats. */
export async function usedNewsTitles(limit = 40): Promise<string[]> {
  const rows = await query<{ title: string }>(
    `SELECT title FROM content_news WHERE used_draft_id IS NOT NULL
     ORDER BY fetched_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => r.title);
}

/* ---------- Drafts ---------- */

export type DraftInput = {
  slug: string;
  title: string;
  description: string;
  summary: string;
  category: string;
  image: string;
  faqs: Faq[];
  bodyMarkdown: string;
  news: Partial<NewsRef>;
  validation: Validation;
  model: string;
  author?: string;
  industry?: string;
  categories?: string[];
  seoKeyword?: string;
  seoTitle?: string;
  publishDate?: string | null;
};

export async function insertDraft(d: DraftInput): Promise<Draft> {
  const rows = await query<Row>(
    `INSERT INTO content_drafts
       (slug, title, description, summary, category, image, faqs, body_markdown, news, validation, model,
        author, industry, categories, seo_keyword, seo_title)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15, $16)
     RETURNING *`,
    [
      d.slug,
      d.title,
      d.description,
      d.summary,
      d.category,
      d.image,
      JSON.stringify(d.faqs),
      d.bodyMarkdown,
      JSON.stringify(d.news),
      JSON.stringify(d.validation),
      d.model,
      d.author ?? "",
      d.industry ?? "",
      d.categories ?? [],
      d.seoKeyword ?? "",
      d.seoTitle ?? "",
    ],
  );
  return rowToDraft(rows[0]);
}

export type DraftPatch = Partial<
  Pick<
    DraftInput,
    | "slug" | "title" | "description" | "summary" | "category" | "image" | "faqs" | "bodyMarkdown" | "validation"
    | "author" | "industry" | "categories" | "seoKeyword" | "seoTitle" | "publishDate"
  >
>;

export async function updateDraft(id: number, p: DraftPatch): Promise<Draft | null> {
  const sets: string[] = [];
  const params: unknown[] = [id];
  const add = (col: string, val: unknown, cast = "") => {
    params.push(val);
    sets.push(`${col} = $${params.length}${cast}`);
  };
  if (p.slug !== undefined) add("slug", p.slug);
  if (p.title !== undefined) add("title", p.title);
  if (p.description !== undefined) add("description", p.description);
  if (p.summary !== undefined) add("summary", p.summary);
  if (p.category !== undefined) add("category", p.category);
  if (p.image !== undefined) add("image", p.image);
  if (p.faqs !== undefined) add("faqs", JSON.stringify(p.faqs), "::jsonb");
  if (p.bodyMarkdown !== undefined) add("body_markdown", p.bodyMarkdown);
  if (p.validation !== undefined) add("validation", JSON.stringify(p.validation), "::jsonb");
  if (p.author !== undefined) add("author", p.author);
  if (p.industry !== undefined) add("industry", p.industry);
  if (p.categories !== undefined) add("categories", p.categories);
  if (p.seoKeyword !== undefined) add("seo_keyword", p.seoKeyword);
  if (p.seoTitle !== undefined) add("seo_title", p.seoTitle);
  if (p.publishDate !== undefined) add("publish_date", p.publishDate || null, "::date");
  if (sets.length === 0) return getDraft(id);
  const rows = await query<Row>(
    `UPDATE content_drafts SET ${sets.join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`,
    params,
  );
  return rows[0] ? rowToDraft(rows[0]) : null;
}

export async function setDraftStatus(
  id: number,
  status: DraftStatus,
  by: string | null,
): Promise<Draft | null> {
  const rows = await query<Row>(
    `UPDATE content_drafts
     SET status = $2,
         updated_at = now(),
         published_at = CASE WHEN $2 = 'published' THEN COALESCE(published_at, now()) ELSE published_at END,
         approved_by = CASE WHEN $2 = 'published' THEN $3 ELSE approved_by END
     WHERE id = $1 RETURNING *`,
    [id, status, by],
  );
  return rows[0] ? rowToDraft(rows[0]) : null;
}

export async function deleteDraft(id: number): Promise<void> {
  await query(`DELETE FROM content_drafts WHERE id = $1`, [id]);
}

export async function getDraft(id: number): Promise<Draft | null> {
  const rows = await query<Row>(`SELECT * FROM content_drafts WHERE id = $1`, [id]);
  return rows[0] ? rowToDraft(rows[0]) : null;
}

export async function listDrafts(): Promise<Draft[]> {
  const rows = await query<Row>(
    `SELECT * FROM content_drafts ORDER BY created_at DESC LIMIT 200`,
  );
  return rows.map(rowToDraft);
}

export async function countDraftsToReview(): Promise<number> {
  if (!process.env.DATABASE_URL) return 0;
  const rows = await query<{ n: string }>(
    `SELECT count(*) AS n FROM content_drafts WHERE status = 'review'`,
  );
  return Number(rows[0]?.n ?? 0);
}

export async function slugTaken(slug: string, exceptId?: number): Promise<boolean> {
  const rows = await query<Row>(
    `SELECT 1 FROM content_drafts WHERE slug = $1 AND ($2::bigint IS NULL OR id <> $2)`,
    [slug, exceptId ?? null],
  );
  return rows.length > 0;
}

export async function recentDraftTitles(limit = 40): Promise<string[]> {
  const rows = await query<{ title: string }>(
    `SELECT title FROM content_drafts WHERE status <> 'rejected'
     ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => r.title);
}

/* The two reads the public blog makes. */

export async function publishedDrafts(): Promise<Draft[]> {
  const rows = await query<Row>(
    `SELECT * FROM content_drafts WHERE status = 'published'
     ORDER BY COALESCE(publish_date::timestamptz, published_at) DESC LIMIT 500`,
  );
  return rows.map(rowToDraft);
}

export async function publishedDraftBySlug(slug: string): Promise<Draft | null> {
  const rows = await query<Row>(
    `SELECT * FROM content_drafts WHERE status = 'published' AND slug = $1`,
    [slug],
  );
  return rows[0] ? rowToDraft(rows[0]) : null;
}

/* ---------- Social ---------- */

export async function upsertSocial(
  draftId: number,
  platform: SocialPlatform,
  content: string,
): Promise<void> {
  await query(
    `INSERT INTO content_social (draft_id, platform, content)
     VALUES ($1, $2, $3)
     ON CONFLICT (draft_id, platform)
     DO UPDATE SET content = EXCLUDED.content, updated_at = now()
     WHERE content_social.status <> 'published'`,
    [draftId, platform, content],
  );
}

export async function updateSocial(
  id: number,
  p: { content?: string; enabled?: boolean },
): Promise<void> {
  await query(
    `UPDATE content_social
     SET content = COALESCE($2, content), enabled = COALESCE($3, enabled), updated_at = now()
     WHERE id = $1 AND status <> 'published'`,
    [id, p.content ?? null, p.enabled ?? null],
  );
}

export async function socialResult(
  id: number,
  r:
    | { ok: true; zernioPostId: string | null; platformUrl: string | null }
    | { ok: false; error: string },
): Promise<void> {
  if (r.ok) {
    await query(
      `UPDATE content_social
       SET status = 'published', zernio_post_id = $2, platform_url = $3, error = NULL,
           published_at = now(), updated_at = now()
       WHERE id = $1`,
      [id, r.zernioPostId, r.platformUrl],
    );
  } else {
    await query(
      `UPDATE content_social SET status = 'failed', error = $2, updated_at = now() WHERE id = $1`,
      [id, r.error.slice(0, 1000)],
    );
  }
}

/** Back to an unsent draft, so the caption can be edited and sent again. */
export async function reopenSocial(id: number): Promise<void> {
  await query(
    `UPDATE content_social
     SET status = 'draft', zernio_post_id = NULL, platform_url = NULL, error = NULL,
         published_at = NULL, updated_at = now()
     WHERE id = $1`,
    [id],
  );
}

export async function getSocial(id: number): Promise<SocialPost | null> {
  const rows = await query<Row>(`SELECT * FROM content_social WHERE id = $1`, [id]);
  return rows[0] ? rowToSocial(rows[0]) : null;
}

export async function socialForDraft(draftId: number): Promise<SocialPost[]> {
  const rows = await query<Row>(
    `SELECT * FROM content_social WHERE draft_id = $1
     ORDER BY array_position(ARRAY['linkedin','facebook','instagram','pinterest'], platform)`,
    [draftId],
  );
  return rows.map(rowToSocial);
}

export type SocialWithDraft = SocialPost & { draftTitle: string; draftSlug: string; draftStatus: DraftStatus };

export async function listSocial(): Promise<SocialWithDraft[]> {
  const rows = await query<Row>(
    `SELECT s.*, d.title AS draft_title, d.slug AS draft_slug, d.status AS draft_status
     FROM content_social s JOIN content_drafts d ON d.id = s.draft_id
     ORDER BY s.updated_at DESC LIMIT 300`,
  );
  return rows.map((r) => ({
    ...rowToSocial(r),
    draftTitle: String(r.draft_title),
    draftSlug: String(r.draft_slug),
    draftStatus: r.draft_status as DraftStatus,
  }));
}

/* ---------- Runs ---------- */

export async function startRun(trigger: string): Promise<number> {
  const rows = await query<{ id: string }>(
    `INSERT INTO content_runs (trigger) VALUES ($1) RETURNING id`,
    [trigger],
  );
  return Number(rows[0].id);
}

export async function finishRun(
  id: number,
  outcome: string,
  detail: string,
  draftId: number | null,
): Promise<void> {
  await query(
    `UPDATE content_runs SET finished_at = now(), outcome = $2, detail = $3, draft_id = $4 WHERE id = $1`,
    [id, outcome, detail.slice(0, 2000), draftId],
  );
}

export async function recentRuns(limit = 8): Promise<Run[]> {
  const rows = await query<Row>(
    `SELECT * FROM content_runs ORDER BY started_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    startedAt: iso(r.started_at) ?? "",
    finishedAt: iso(r.finished_at),
    trigger: String(r.trigger),
    outcome: String(r.outcome),
    detail: String(r.detail ?? ""),
    draftId: r.draft_id ? Number(r.draft_id) : null,
  }));
}

/** A run still marked running after 15 minutes was killed by the platform. */
export async function runInProgress(): Promise<boolean> {
  const rows = await query<Row>(
    `SELECT 1 FROM content_runs
     WHERE outcome = 'running' AND started_at > now() - interval '15 minutes'`,
  );
  return rows.length > 0;
}

/* ---------- Media ---------- */

export async function insertMedia(m: { mime: string; bytes: Buffer; alt: string; by: string | null }): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO content_media (mime, bytes, size, alt, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [m.mime, m.bytes, m.bytes.length, m.alt, m.by],
  );
  return rows[0].id;
}

export async function getMedia(id: string): Promise<{ mime: string; bytes: Buffer } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await query<{ mime: string; bytes: Buffer }>(
    `SELECT mime, bytes FROM content_media WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}
