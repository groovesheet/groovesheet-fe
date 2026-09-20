import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import FinalCta from "@/components/FinalCta";
import { articleJsonLd, faqJsonLd, breadcrumbJsonLd, organizationJsonLd } from "@/lib/schema";
import { getPostAny, postSlugs } from "@/lib/posts";
import PostCard from "@/components/blog/PostCard";
import { categoryBySlug, relatedTo, topicsOf } from "@/lib/blogIndex";
import "../../blog.css";

/* Every post on the blog renders here: .mdx files under content/posts/, posts
   approved in /internal/blog, and the eleven originals in Supabase's
   blog_posts. src/lib/posts.ts merges the three.

   File posts are prerendered below. Any other slug is looked up in the
   database on first request, rendered once and cached; approval and unpublish
   both revalidate the path. A slug in none of the three still 404s. */
export const dynamicParams = true;
export const revalidate = 3600;

export function generateStaticParams() {
  return postSlugs().map((slug) => ({ slug }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostAny(slug);
  if (!post) return {};
  const { title, description, summary, seoTitle, seoKeyword, image, publishedAt, updatedAt, author } =
    post.frontmatter;
  return {
    // What search shows may differ from the headline on the page.
    title: seoTitle || title,
    description: description || summary,
    ...(seoKeyword ? { keywords: [seoKeyword] } : {}),
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: "article",
      title: seoTitle || title,
      description: description || summary,
      url: `/blog/${slug}`,
      images: [image || "/og.png"],
      ...(publishedAt ? { publishedTime: publishedAt } : {}),
      ...(updatedAt ? { modifiedTime: updatedAt } : {}),
      ...(author ? { authors: [author] } : {}),
    },
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const post = await getPostAny(slug);
  if (!post) notFound();

  const fm = post.frontmatter;
  const path = `/blog/${slug}`;
  const description = fm.description || fm.summary || "";
  const topics = topicsOf(post)
    .map(categoryBySlug)
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const primary = topics[0];
  const related = await relatedTo(path, topics.map((t) => t.slug));
  const dateLabel = fm.publishedAt
    ? new Date(`${fm.publishedAt}T00:00:00Z`).toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";

  /* Markdown only: no JSX in the body, so generated content cannot introduce
     components.

     The try/catch is load-bearing, not defensive habit. MDX throws at compile
     time on stray angle brackets in prose (`<Foo>`, `a < b`), and because file
     posts are prerendered, an uncaught throw fails `next build` for the WHOLE
     SITE: one malformed generated post would take down every page. For a
     database post the same throw would be a 500 on a page we just announced. Degrading to escaped plain text keeps the deploy alive and the
     content indexable, and the console error makes the bad post obvious.
     `scripts/generate-post.mjs` validates before writing; this is the backstop
     for anything that gets past it. */
  let content: React.ReactNode;
  try {
    ({ content } = await compileMDX({
      source: post.body,
      options: { parseFrontmatter: false },
    }));
  } catch (err) {
    console.error(
      `[blog] MDX compile failed for /blog/${slug}: rendering as plain text.\n` +
        `Fix the body in /internal/blog, or at content/posts/${slug}.mdx. Cause: ${
          err instanceof Error ? err.message : String(err)
        }`,
    );
    content = post.body
      .split(/\n{2,}/)
      .map((para, i) => <p key={i}>{para.trim()}</p>);
  }

  const articleLd = articleJsonLd({
    path,
    headline: fm.title,
    description,
    datePublished: fm.publishedAt || "",
    dateModified: fm.updatedAt || fm.publishedAt || "",
    image: fm.image || "/og.png",
    authorName: fm.author,
    section: primary?.label,
    keywords: fm.seoKeyword ? [fm.seoKeyword] : undefined,
  });
  const crumbLd = breadcrumbJsonLd([
    { name: "Blog", path: "/blog" },
    ...(primary ? [{ name: primary.label, path: `/blog/category/${primary.slug}` }] : []),
    { name: fm.title, path },
  ]);
  const faqs = fm.faqs ?? [];

  return (
    <div className="gs-dotgrid">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      {faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faqs)) }}
        />
      )}

      <SiteHeader />

      <header className="hero-light" data-screen-label="Hero">
        <div
          className="gs-container"
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
        >
          <span className="gs-overline">
            <Link href="/blog" style={{ color: "inherit" }}>Blog</Link>
            {primary ? (
              <>
                {" · "}
                <Link href={`/blog/category/${primary.slug}`} style={{ color: "inherit" }}>
                  {primary.label}
                </Link>
              </>
            ) : fm.category ? (
              ` · ${fm.category}`
            ) : null}
          </span>
          <h1 style={{ maxWidth: 820 }}>{fm.title}</h1>
          {(fm.summary || description) && (
            <p className="hero-sub" style={{ maxWidth: 640 }}>
              {fm.summary || description}
            </p>
          )}
          {(fm.author || dateLabel) && (
            <p className="article-meta" style={{ margin: 0 }}>
              {[fm.author ? `By ${fm.author}` : "", dateLabel].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </header>

      <section className="band article-wide" data-screen-label="Article">
        <div className="gs-container">
          <article className="article">{content}</article>

          {/* Same markup as the hand-written posts: without `gs-accordion`
              the <details> get no hairlines and no summary layout at all. */}
          {faqs.length > 0 && (
            <article className="article" style={{ marginTop: 48 }}>
              <h2>Frequently asked questions</h2>
              <div className="gs-accordion faq-wrap">
                {faqs.map((f) => (
                  <details key={f.q}>
                    <summary>{f.q}</summary>
                    <div className="gs-accordion-body gs-body-md">{f.a}</div>
                  </details>
                ))}
              </div>
            </article>
          )}
        </div>
      </section>

      {related.length > 0 && (
        <section className="band band--soft" data-screen-label="Related posts">
          <div className="gs-container">
            <div className="blog-section-head">
              <h2>Keep reading</h2>
              {primary ? (
                <p>
                  More on <Link href={`/blog/category/${primary.slug}`}>{primary.label}</Link>.
                </p>
              ) : null}
            </div>
            <div className="grid-3" style={{ rowGap: "var(--space-xl)" }}>
              {related.map((c) => (
                <PostCard key={c.href} card={c} />
              ))}
            </div>
          </div>
        </section>
      )}

      <FinalCta keyword={fm.seoKeyword} />

      <SiteFooter />
    </div>
  );
}
