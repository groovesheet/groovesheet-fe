import type { Metadata } from "next";
import Link from "next/link";
import { PenLine, Share2 } from "lucide-react";
import PageHeader from "./_components/PageHeader";
import { countDraftsToReview, listSocial, publishedDrafts, recentRuns } from "@/lib/content/store";

export const metadata: Metadata = {
  title: "Internal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/* Every count is wrapped. Before src/lib/content/schema.sql has been applied
   these tables do not exist, and the landing page is exactly where someone
   arrives to find out why nothing works. It has to render and say so, not
   500. */
async function safely<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch {
    return fallback;
  }
}

export default async function InternalIndex() {
  const [toReview, published, social, runs] = await Promise.all([
    safely(() => countDraftsToReview(), 0),
    safely(async () => (await publishedDrafts()).length, 0),
    safely(() => listSocial(), []),
    safely(() => recentRuns(1), []),
  ]);

  const live = social.filter((s) => s.status === "published").length;
  const failed = social.filter((s) => s.status === "failed").length;

  const counters = [
    { value: toReview, label: "Waiting for review" },
    { value: published, label: "Posts published" },
    { value: live, label: "Social posts live" },
    { value: failed, label: "Sends that failed" },
  ];

  const last = runs[0];
  const lastLine = last
    ? `Last run ${new Date(last.startedAt).toLocaleString("en-US", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}: ${last.outcome}.`
    : "No run recorded yet.";

  const modules = [
    {
      href: "/internal/blog",
      title: "Blog",
      desc: "Drafts written from the week's music tech news. Read, edit, approve.",
      meta: toReview > 0 ? `${toReview} waiting` : "Nothing waiting",
      // Waiting is a to-do, not a fault: emphasis, not the danger colour.
      metaClass: toReview > 0 ? "is-attn" : "",
    },
    {
      href: "/internal/social",
      title: "Social",
      desc: "The LinkedIn, Facebook, Instagram and Pinterest posts written from each one.",
      meta: failed > 0 ? `${failed} failed` : `${live} live`,
      metaClass: failed > 0 ? "is-due" : "",
    },
  ];

  return (
    <>
      <PageHeader
        title="Internal"
        desc="The content pipeline runs itself every three days. It publishes what passes its own checks, and holds anything that does not for you here."
      />

      <div className="int-stack">
        <div className="int-counters">
          {counters.map((c) => (
            <div key={c.label} className="int-stat">
              <p className="int-stat-label">{c.label}</p>
              <p className="int-stat-value">{c.value}</p>
            </div>
          ))}
        </div>

        <p className="int-last-run">{lastLine}</p>

        <div className="int-modules">
          {modules.map((m) => (
            <Link key={m.href} href={m.href} className="int-module-card">
              <div className="int-module-head">
                <span className="int-module-glyph">
                  {m.href === "/internal/blog" ? (
                    <PenLine size={16} aria-hidden="true" />
                  ) : (
                    <Share2 size={16} aria-hidden="true" />
                  )}
                </span>
                <span className="int-module-title">{m.title}</span>
              </div>
              <p className="int-module-desc">{m.desc}</p>
              <span className={`int-module-meta ${m.metaClass}`}>{m.meta}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
