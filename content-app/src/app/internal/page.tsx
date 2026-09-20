import type { Metadata } from "next";
import Link from "next/link";
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
      glyph: "✎",
      title: "Blog",
      desc: "Drafts written from the week's music tech news. Read, edit, approve.",
      meta: toReview > 0 ? `${toReview} waiting` : "nothing waiting",
      metaClass: toReview > 0 ? "is-due" : "",
    },
    {
      href: "/internal/social",
      glyph: "◎",
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
        desc="The content pipeline runs itself every three days. Nothing it writes goes out until someone here approves it."
      />

      <div className="int-stack">
        <div className="int-counters">
          {counters.map((c) => (
            <div key={c.label}>
              <div className="gs-stat-value">{c.value}</div>
              <div className="gs-stat-label">{c.label}</div>
            </div>
          ))}
        </div>

        <p className="int-module-meta">{lastLine}</p>

        <div className="int-modules">
          {modules.map((m) => (
            <Link key={m.href} href={m.href} className="gs-card gs-card--hover int-module-card">
              <div className="int-module-head">
                <span className="gs-glyph-plate int-module-glyph">{m.glyph}</span>
                <span className="gs-title-md">{m.title}</span>
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
