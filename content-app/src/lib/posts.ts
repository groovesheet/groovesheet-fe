import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { embedSrcFromUrl } from "./editor/videoEmbed";

/* CMS-backed blog posts.
 *
 * The 11 original posts are hand-written route folders under src/app/blog/<slug>/.
 * Next resolves those static segments before the dynamic [slug] route, so they
 * keep working untouched: this module only serves posts that live as .mdx files
 * under content/posts/, which is where Keystatic (and the generation pipeline)
 * writes them. */

const POSTS_DIR = join(process.cwd(), "content", "posts");

export type PostFaq = { q: string; a: string };

export type PostFrontmatter = {
  title: string;
  /** Meta description. Falls back to `summary` when absent. */
  description?: string;
  summary?: string;
  category?: string;
  publishedAt?: string;
  updatedAt?: string;
  image?: string;
  /** Rendered as an FAQ block and as FAQPage JSON-LD. */
  faqs?: PostFaq[];
  /* The fields below come from the portal editor. File posts may set them in
     frontmatter too; nothing requires them. */
  author?: string;
  /** Title for search results, when it should differ from the on-page one. */
  seoTitle?: string;
  seoKeyword?: string;
  /** Topic slugs from pipeline.config.json `taxonomy.categories`. */
  categories?: string[];
  industry?: string;
};

export type Post = {
  slug: string;
  frontmatter: PostFrontmatter;
  body: string;
};

export function postSlugs(): string[] {
  if (!existsSync(POSTS_DIR)) return [];
  return readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""));
}

export function getPost(slug: string): Post | null {
  // Guard against traversal: slugs come from the URL.
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const path = join(POSTS_DIR, `${slug}.mdx`);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  return {
    slug,
    frontmatter: parseFrontmatter(raw),
    body: videosToHtml(tablesToHtml(stripFrontmatter(raw))),
  };
}

/* YAML frontmatter reader, covering the subset Keystatic actually writes.
 *
 * Keystatic serialises frontmatter with `yaml.stringify(x)` at its default
 * lineWidth of 80, so any value longer than that comes back *folded across
 * several lines*, as a plain scalar, a double-quoted scalar, or a `|-` block
 * when the string contains newlines. A naive line-per-key reader silently
 * truncates all three, which corrupts the meta description and the FAQ answers
 * the moment a post is edited in the CMS. Everything below exists to read those
 * shapes back correctly:
 *
 *   description: "Long text that wraps
 *     onto continuation lines."
 *   summary: Plain text that also
 *     wraps onto continuation lines.
 *   faqs:
 *     - q: Short question?
 *       a: |-
 *         Block scalar answer.
 *
 * Still not a general YAML parser (no anchors, tags, flow collections or
 * multi-document input): it handles what the CMS emits and ignores the rest.
 * If `yaml` is ever promoted to a direct dependency, replace this wholesale. */
function parseFrontmatter(raw: string): PostFrontmatter {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { title: "" };

  const lines = match[1].split(/\r?\n/);
  const fm: Record<string, unknown> = {};
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || indentOf(line) !== 0) {
      i++;
      continue;
    }

    const kv = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!kv) {
      i++;
      continue;
    }
    const key = kv[1];
    const rest = kv[2].trim();

    if (key === "faqs") {
      // `faqs: []` (or any inline form) carries nothing to read.
      if (rest === "") {
        const seq = readFaqs(lines, i + 1);
        if (seq.faqs.length) fm.faqs = seq.faqs;
        i = seq.next;
      } else {
        i++;
      }
      continue;
    }

    if (rest === "" || rest === "null" || rest === "~") {
      i++;
      continue;
    }

    const scalar = readScalar(lines, i, rest, 0);
    if (scalar.value !== "") fm[key] = scalar.value;
    i = scalar.next;
  }

  return fm as PostFrontmatter;
}

/** Parse a `- q: ... / a: ...` sequence. Returns the index of the line after it. */
function readFaqs(lines: string[], start: number): { faqs: PostFaq[]; next: number } {
  const faqs: PostFaq[] = [];
  let current: Partial<PostFaq> | null = null;
  let itemIndent = -1;
  let i = start;

  const commit = () => {
    if (current?.q && current?.a) faqs.push(current as PostFaq);
    current = null;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const indent = indentOf(line);
    const item = line.trim().match(/^-\s+(.*)$/);

    if (item) {
      // A dash at a shallower indent belongs to some other sequence.
      if (itemIndent === -1) itemIndent = indent;
      else if (indent !== itemIndent) break;
      commit();
      current = {};

      const kv = item[1].match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
      if (kv) {
        // Continuations align under the key, two columns past the dash.
        const scalar = readScalar(lines, i, kv[2].trim(), indent + 2);
        setFaqField(current, kv[1], scalar.value);
        i = scalar.next;
        continue;
      }
      i++;
      continue;
    }

    // Anything at or left of the dash column ends the sequence.
    if (itemIndent === -1 || indent <= itemIndent) break;

    const kv = line.trim().match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (kv && current) {
      const scalar = readScalar(lines, i, kv[2].trim(), indent);
      setFaqField(current, kv[1], scalar.value);
      i = scalar.next;
      continue;
    }
    i++;
  }

  commit();
  return { faqs, next: i };
}

function setFaqField(faq: Partial<PostFaq>, key: string, value: string) {
  if (key === "q") faq.q = value;
  else if (key === "a") faq.a = value;
}

/* Read one scalar value. `inline` is whatever followed the colon; `indent` is
   the column the owning key starts at, which is what continuation lines must
   exceed. Returns the index of the first line past the value. */
function readScalar(
  lines: string[],
  i: number,
  inline: string,
  indent: number,
): { value: string; next: number } {
  // Block scalar: `|`, `>`, with optional chomping/indent indicators.
  const block = inline.match(/^([|>])([+-]?)\d*\s*$/);
  if (block) {
    const folded = block[1] === ">";
    const keepTrailing = block[2] === "+";
    const body: string[] = [];
    let contentIndent = -1;
    let j = i + 1;

    for (; j < lines.length; j++) {
      const line = lines[j];
      if (!line.trim()) {
        body.push("");
        continue;
      }
      if (indentOf(line) <= indent) break;
      if (contentIndent === -1) contentIndent = indentOf(line);
      body.push(line.slice(contentIndent));
    }
    while (body.length && body[body.length - 1] === "") body.pop();

    const text = folded ? foldLines(body) : body.join("\n");
    return { value: keepTrailing ? `${text}\n` : text, next: j };
  }

  const quote = inline[0];
  if (quote === '"' || quote === "'") {
    // A folded quoted scalar keeps going until its closing quote.
    let buffer = inline;
    let j = i;
    while (!closesQuote(buffer, quote) && j + 1 < lines.length) {
      j++;
      buffer += ` ${lines[j].trim()}`;
    }
    return { value: unquote(buffer), next: j + 1 };
  }

  // Plain scalar: absorb more-indented lines that are not keys or list items.
  let buffer = inline;
  let j = i;
  while (j + 1 < lines.length) {
    const line = lines[j + 1];
    if (!line.trim() || indentOf(line) <= indent) break;
    const text = line.trim();
    if (/^-\s/.test(text) || /^[A-Za-z][A-Za-z0-9_-]*:(\s|$)/.test(text)) break;
    buffer += ` ${text}`;
    j++;
  }
  return { value: buffer.trim(), next: j + 1 };
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/** YAML folding: a blank line is a newline, everything else joins with a space. */
function foldLines(body: string[]): string {
  let out = "";
  for (const line of body) {
    if (line === "") out += "\n";
    else out += out === "" || out.endsWith("\n") ? line : ` ${line}`;
  }
  return out;
}

/** True when `s` opens with `quote` and its final character closes it. */
function closesQuote(s: string, quote: string): boolean {
  if (s.length < 2) return false;
  let i = 1;
  while (i < s.length) {
    const c = s[i];
    if (quote === '"' && c === "\\") {
      i += 2;
      continue;
    }
    if (c === quote) {
      if (quote === "'" && s[i + 1] === quote) {
        i += 2;
        continue;
      }
      return i === s.length - 1;
    }
    i++;
  }
  return false;
}

function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

/* GFM pipe tables -> HTML table markup.
 *
 * compileMDX() runs a bare MDX pipeline: remark-gfm is not installed, so a pipe
 * table would otherwise render as one paragraph full of literal "|" characters.
 * MDX v3 renders HTML table tags natively and still parses inline markdown
 * inside a single-line <td>, so converting here yields a real table with bold,
 * links and code intact.
 *
 * This does not weaken the "markdown only, no components" guarantee the route
 * relies on: the tags are generated here from a strict pipe-table grammar, and
 * cell text has <, { and } escaped: the only characters MDX treats as syntax.
 * Generated content therefore still cannot introduce a component or evaluate an
 * expression. Column alignment (:---, ---:) is parsed but not applied.
 *
 * If remark-gfm is ever added as a dependency, delete this and pass it via
 * options.mdxOptions.remarkPlugins instead. */
const TABLE_DELIMITER = /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-*:?\s*\|?\s*$/;

function tablesToHtml(body: string): string {
  const lines = body.split("\n");
  const out: string[] = [];
  let fence: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Never touch fenced code blocks.
    const fenceStart = line.match(/^\s*(```+|~~~+)/);
    if (fenceStart) {
      if (fence && line.trimStart().startsWith(fence)) fence = null;
      else if (!fence) fence = fenceStart[1];
      out.push(line);
      continue;
    }
    if (fence) {
      out.push(line);
      continue;
    }

    // A table is a header row, then a delimiter row, then zero or more rows.
    const next = lines[i + 1] ?? "";
    if (line.includes("|") && next.includes("|") && TABLE_DELIMITER.test(next)) {
      const header = splitRow(line);
      if (splitRow(next).length === header.length) {
        const rows: string[][] = [];
        let j = i + 2;
        while (j < lines.length && lines[j].trim() && lines[j].includes("|")) {
          rows.push(splitRow(lines[j]));
          j++;
        }
        out.push(renderTable(header, rows));
        i = j - 1;
        continue;
      }
    }

    out.push(line);
  }

  return out.join("\n");
}

/** Split one pipe row into trimmed cells, honouring \| escapes. */
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);

  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (s[i] === "|") {
      cells.push(cur);
      cur = "";
    } else {
      cur += s[i];
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

/* Emitted without blank lines inside the element: a blank line would end the
   JSX block and drop the rest of the table back into markdown. */
function renderTable(header: string[], rows: string[][]): string {
  const head = header.map((c) => `<th>${escapeCell(c)}</th>`).join("");
  const body = rows.map(
    (row) =>
      `<tr>${header.map((_, k) => `<td>${escapeCell(row[k] ?? "")}</td>`).join("")}</tr>`,
  );
  return [
    "",
    "<table>",
    `<thead><tr>${head}</tr></thead>`,
    "<tbody>",
    ...body,
    "</tbody>",
    "</table>",
    "",
  ].join("\n");
}

/** Neutralise the three characters MDX treats as syntax. */
function escapeCell(s: string): string {
  return s
    .replace(/</g, "&lt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");
}

/* Video embeds, written as a markdown image whose target is a video file:
 *
 *   ![Alt text](/uploads/clip.mp4)
 *   ![Alt text](/uploads/clip.mp4 "/uploads/clip-poster.webp")
 *
 * Markdown has no video syntax, and the body deliberately stays JSX-free so a
 * generated or CMS-authored post cannot introduce components. Reusing the image
 * form keeps both properties: authors write plain markdown, Keystatic round-trips
 * it unchanged, and the <video> element is emitted here rather than authored in
 * the post. The optional title is the poster frame.
 *
 * `preload="none"` is the point of the poster: a page with four clips on it would
 * otherwise pull tens of megabytes before anyone presses play. */
const VIDEO_LINE =
  /^\s*!\[([^\]]*)\]\(\s*(\S+\.(mp4|webm))(?:\s+"([^"]*)")?\s*\)\s*$/;

function videosToHtml(body: string): string {
  const lines = body.split("\n");
  const out: string[] = [];
  let fence: string | null = null;

  for (const line of lines) {
    // Never touch fenced code blocks.
    const fenceStart = line.match(/^\s*(```+|~~~+)/);
    if (fenceStart) {
      if (fence && line.trimStart().startsWith(fence)) fence = null;
      else if (!fence) fence = fenceStart[1];
      out.push(line);
      continue;
    }
    if (fence) {
      out.push(line);
      continue;
    }

    const m = line.match(VIDEO_LINE);
    if (!m) {
      out.push(line);
      continue;
    }

    const [, alt, src, ext, poster] = m;
    const attrs = [
      "controls",
      'preload="none"',
      "playsInline",
      alt ? `aria-label="${escapeAttr(alt)}"` : "",
      poster ? `poster="${escapeAttr(poster)}"` : "",
    ].filter(Boolean);

    // No blank lines inside: one would close the JSX block and drop the rest of
    // the element back into markdown. Same constraint as renderTable.
    out.push(
      "",
      `<video ${attrs.join(" ")}>`,
      `<source src="${escapeAttr(src)}" type="video/${ext}" />`,
      "</video>",
      "",
    );
  }

  return out.join("\n");
}

/** Escape a value being interpolated into a JSX attribute. */
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");
}

function unquote(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t
      .slice(1, -1)
      .replace(/\\(["\\/])/g, "$1")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t");
  }
  // Single-quoted YAML has exactly one escape: '' means a literal quote.
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) {
    return t.slice(1, -1).replace(/''/g, "'");
  }
  return t;
}

/** Newest first. Posts without a date sort last. */
export function allPosts(): Post[] {
  return postSlugs()
    .map(getPost)
    .filter((p): p is Post => p !== null)
    .sort((a, b) =>
      (b.frontmatter.publishedAt || "").localeCompare(a.frontmatter.publishedAt || ""),
    );
}

/* ---------- Posts approved in the portal ----------
 *
 * The content pipeline (src/lib/content/) holds its posts in Postgres, not in
 * content/posts/, so that approving one in /internal/blog publishes it at once
 * with no commit and no deploy. These two functions are the merged view the
 * public routes read: files first, then approved database rows.
 *
 * Every database read is wrapped. The blog must render, and `next build` must
 * pass, with no database at all: a checkout without DATABASE_URL, a paused
 * Supabase project and a pooler timeout all degrade to "files only". */

async function dbPosts(): Promise<Post[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    const { publishedDrafts } = await import("./content/store");
    return (await publishedDrafts()).map(draftToPost);
  } catch (err) {
    console.error("[blog] database posts unavailable:", err instanceof Error ? err.message : err);
    return [];
  }
}

/* ---------- The posts that predate the pipeline ----------
 *
 * Eleven hand-written posts in Supabase's `blog_posts`, live at /blog/<slug>
 * since before this app existed. See content/legacy.ts for why they are read
 * in place rather than copied. Wrapped like every other database read: if the
 * table is missing or unreachable the rest of the blog still renders. */

async function legacyToPosts(): Promise<Post[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    const { legacyPosts } = await import("./content/legacy");
    return (await legacyPosts()).map(legacyToPost);
  } catch (err) {
    console.error("[blog] legacy posts unavailable:", err instanceof Error ? err.message : err);
    return [];
  }
}

function legacyToPost(p: {
  slug: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  coverImageUrl: string | null;
  author: string;
  publishedAt: string;
}): Post {
  const day = p.publishedAt.slice(0, 10);
  return {
    slug: p.slug,
    frontmatter: {
      title: p.title,
      /* These posts carry one excerpt and no separate meta description. The
         excerpt does both jobs rather than leaving the description empty,
         which would drop the meta tag on eleven indexed pages. */
      description: p.excerpt,
      summary: p.excerpt,
      category: "Article",
      publishedAt: day,
      updatedAt: day,
      image: p.coverImageUrl || "/og.png",
      faqs: [],
      author: p.author,
      seoTitle: "",
      seoKeyword: "",
      categories: [],
      industry: "",
    },
    body: prepareBody(p.bodyMarkdown),
  };
}

type PublishedRow = {
  slug: string;
  title: string;
  description: string;
  summary: string;
  category: string;
  image: string;
  faqs: PostFaq[];
  bodyMarkdown: string;
  publishedAt: string | null;
  updatedAt: string;
  author: string;
  seoTitle: string;
  seoKeyword: string;
  categories: string[];
  industry: string;
  publishDate: string | null;
};

function draftToPost(d: PublishedRow): Post {
  return {
    slug: d.slug,
    frontmatter: {
      title: d.title,
      description: d.description,
      summary: d.summary,
      category: d.category,
      publishedAt: d.publishDate ?? (d.publishedAt ?? d.updatedAt).slice(0, 10),
      updatedAt: d.updatedAt.slice(0, 10),
      image: d.image,
      faqs: d.faqs,
      author: d.author,
      seoTitle: d.seoTitle,
      seoKeyword: d.seoKeyword,
      categories: d.categories,
      industry: d.industry,
    },
    body: prepareBody(d.bodyMarkdown),
  };
}

/* Hosted video, written as a bare URL alone on its line. That is what the
 * portal editor's video button saves (YouTube, Vimeo, Loom, Twitch), and the
 * player is emitted here for the same reason <video> is above: the body stays
 * plain markdown and cannot introduce components. */
function embedsToHtml(body: string): string {
  let fence: string | null = null;
  return body
    .split("\n")
    .map((line) => {
      const fenceStart = line.match(/^\s*(```+|~~~+)/);
      if (fenceStart) {
        if (fence && line.trimStart().startsWith(fence)) fence = null;
        else if (!fence) fence = fenceStart[1];
        return line;
      }
      if (fence) return line;
      const url = line.trim().replace(/^<(.+)>$/, "$1");
      if (!/^https?:\/\/\S+$/.test(url)) return line;
      const src = embedSrcFromUrl(url);
      if (!src) return line;
      return [
        "",
        `<div style={{position:"relative",aspectRatio:"16 / 9",margin:"var(--space-lg) 0"}}>`,
        `<iframe src="${escapeAttr(src)}" title="Video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen style={{position:"absolute",inset:0,width:"100%",height:"100%",border:0}} />`,
        "</div>",
        "",
      ].join("\n");
    })
    .join("\n");
}

/** Markdown as the public page compiles it, for the portal's preview. */
export function prepareBody(markdown: string): string {
  return embedsToHtml(videosToHtml(tablesToHtml(markdown)));
}

/** A file post, an approved pipeline post, or one of the originals. */
export async function getPostAny(slug: string): Promise<Post | null> {
  const file = getPost(slug);
  if (file) return file;
  if (!/^[a-z0-9-]+$/.test(slug) || !process.env.DATABASE_URL) return null;
  try {
    const { publishedDraftBySlug } = await import("./content/store");
    const d = await publishedDraftBySlug(slug);
    if (d) return draftToPost(d);
  } catch (err) {
    console.error(`[blog] lookup failed for ${slug}:`, err instanceof Error ? err.message : err);
  }
  try {
    const { legacyPostBySlug } = await import("./content/legacy");
    const p = await legacyPostBySlug(slug);
    return p ? legacyToPost(p) : null;
  } catch (err) {
    console.error(`[blog] legacy lookup failed for ${slug}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** Every source together, newest first. A file wins a slug clash, then a
 *  pipeline post, then one of the originals. */
export async function allPostsAny(): Promise<Post[]> {
  const files = allPosts();
  const taken = new Set(files.map((p) => p.slug));
  const fromDb = (await dbPosts()).filter((p) => !taken.has(p.slug));
  fromDb.forEach((p) => taken.add(p.slug));
  const fromLegacy = (await legacyToPosts()).filter((p) => !taken.has(p.slug));
  return [...files, ...fromDb, ...fromLegacy].sort((a, b) =>
    (b.frontmatter.publishedAt || "").localeCompare(a.frontmatter.publishedAt || ""),
  );
}
