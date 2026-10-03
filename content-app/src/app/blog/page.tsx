import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import PostCard from "@/components/blog/PostCard";
import TopicNav from "@/components/blog/TopicNav";
import { allCards, liveCategories } from "@/lib/blogIndex";
import "../blog.css";

export const metadata: Metadata = {
  title: "Blog: Transcription, Stems and Notation",
  description:
    "Guides and industry news from GrooveSheet: how automatic music transcription and stem separation actually work, and how to get a score you can play from.",
};

/* Portal posts are published from the database. Approval revalidates this
   page at once; the hourly window is the backstop. */
export const revalidate = 3600;

export default async function Page() {
  const [cards, topics] = await Promise.all([allCards(), liveCategories()]);

  /* Volumet pinned one slug here. Pinning a slug in a repo that deploys
     separately from the posts means the feature goes stale the week nobody
     remembers to change it, so the newest post takes the slot. */
  const [feature, ...rest] = cards;

  return (
    <div className="gs-dotgrid">
      <SiteHeader />

      <header className="hero-light">
        <div className="gs-container" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="gs-overline">Blog</span>
          <h1>The GrooveSheet blog.</h1>
          <p className="hero-sub">
            How automatic transcription, stem separation and notation actually work, what is
            changing in music tech, and how to get a chart you can play from.
          </p>
        </div>
      </header>

      {feature ? (
        <section className="band band--tight">
          <div className="gs-container">
            <Link className="blog-feature" href={feature.href}>
              <div className="blog-feature__copy">
                <span className="article-meta">Latest</span>
                <h2>{feature.title}</h2>
                <p>{feature.desc}</p>
                <span className="blog-feature__go">
                  Read article <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
                </span>
              </div>
              <div className="media-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img decoding="async" src={feature.image} alt={feature.alt} />
              </div>
            </Link>
          </div>
        </section>
      ) : null}

      <section className="band">
        <div className="gs-container">
          <div className="blog-section-head">
            <h2>Articles &amp; guides</h2>
            <p>Explainers, comparisons and news, filed by topic.</p>
          </div>
          <TopicNav topics={topics} />
          {rest.length > 0 ? (
            <div className="grid-3" style={{ rowGap: 32 }}>
              {rest.map((c) => (
                <PostCard key={c.href} card={c} />
              ))}
            </div>
          ) : (
            <p className="post-card__desc">Nothing else published yet.</p>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
