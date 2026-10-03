import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import FinalCta from "@/components/FinalCta";
import PostCard from "@/components/blog/PostCard";
import TopicNav from "@/components/blog/TopicNav";
import { CATEGORIES, cardsIn, categoryBySlug, liveCategories } from "@/lib/blogIndex";
import { breadcrumbJsonLd } from "@/lib/schema";
import "../../../blog.css";

/* A topic hub: every post filed under one category, at its own address.

   These exist for search as much as for readers. A hub gives each topic one
   page that every post in it links up to and that links down to all of them,
   which is the cluster shape search engines reward, and it gives the topic a
   title and description of its own to rank with. */

export const revalidate = 3600;

/* True, although generateStaticParams below already lists every topic.

   With it false, these pages are written once at build and there is no runtime
   path to regenerate them into: revalidatePath is accepted and silently does
   nothing, so approving a post added it to /blog and the sitemap immediately
   while its own topic hub kept the old list until the next deploy. A reader
   who clicked the topic pill under a new post found a page that did not list
   it.

   Nothing is lost by making it true. An unknown slug does not fall through to
   a rendered page: categoryBySlug returns undefined and the component calls
   notFound(), so /blog/category/anything-else is still a 404. */
export const dynamicParams = true;

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const cat = categoryBySlug(slug);
  if (!cat) return {};
  const count = (await cardsIn(slug)).length;
  return {
    title: `${cat.label}: articles and guides`,
    description: cat.description,
    alternates: { canonical: `/blog/category/${slug}` },
    // An empty hub is a thin page. It comes into the index with its first post.
    robots: count === 0 ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage({ params }: Params) {
  const { slug } = await params;
  const cat = categoryBySlug(slug);
  if (!cat) notFound();

  const [cards, topics] = await Promise.all([cardsIn(slug), liveCategories()]);
  const path = `/blog/category/${slug}`;

  const crumbLd = breadcrumbJsonLd([
    { name: "Blog", path: "/blog" },
    { name: cat.label, path },
  ]);
  const listLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${cat.label}: GrooveSheet blog`,
    description: cat.description,
    url: `https://www.groovesheet.net${path}`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: cards.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `https://www.groovesheet.net${c.href}`,
        name: c.title,
      })),
    },
  };

  return (
    <div className="gs-dotgrid">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listLd) }} />

      <SiteHeader />

      <header className="hero-light" data-screen-label="Hero">
        <div className="gs-container" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span className="gs-overline">
            <Link href="/blog" style={{ color: "inherit" }}>Blog</Link> · Topic
          </span>
          <h1 style={{ maxWidth: 760 }}>{cat.label}</h1>
          <p className="hero-sub" style={{ maxWidth: 640 }}>{cat.description}</p>
        </div>
      </header>

      <section className="band" data-screen-label="Posts">
        <div className="gs-container">
          <TopicNav topics={topics} current={slug} />
          {cards.length === 0 ? (
            <p className="gs-body-md" style={{ color: "var(--color-muted-foreground)" }}>
              Nothing filed here yet. <Link href="/blog">See all posts</Link>.
            </p>
          ) : (
            <div className="grid-3" style={{ rowGap: 32 }}>
              {cards.map((c) => (
                <PostCard key={c.href} card={c} />
              ))}
            </div>
          )}
        </div>
      </section>

      <FinalCta keyword={cat.label} />

      <SiteFooter />
    </div>
  );
}
