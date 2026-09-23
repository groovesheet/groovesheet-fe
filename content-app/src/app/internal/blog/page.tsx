import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "../_components/PageHeader";
import EmptyState from "../_components/EmptyState";
import { hasDatabase } from "@/lib/content/db";
import { llmConfigured } from "@/lib/content/llm";
import { listDrafts, recentNews, recentRuns } from "@/lib/content/store";
import { uploadPostConfigured } from "@/lib/content/uploadPost";
import { zernioConfigured } from "@/lib/content/zernio";
import type { DraftStatus } from "@/lib/content/types";
import RunNow from "./RunNow";

export const metadata: Metadata = {
  title: "Blog",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/* Status pills follow the design system's job-status recipe: a solid fill
   with white text, never a tinted fill with a matching outline. */
const TONE: Record<DraftStatus, string> = {
  review: "is-review",
  published: "is-published",
  rejected: "is-rejected",
};
const LABEL: Record<DraftStatus, string> = {
  review: "Needs Review",
  published: "Published",
  rejected: "Rejected",
};

function day(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export default async function BlogPage() {
  if (!hasDatabase()) {
    return (
      <>
        <PageHeader title="Blog" desc="Music tech news, drafted into posts and held here for approval." />
        <EmptyState
          glyph="✎"
          title="No Database"
          desc="The content pipeline needs DATABASE_URL. Apply src/lib/content/schema.sql once it is set."
        />
      </>
    );
  }

  const [drafts, news, runs] = await Promise.all([listDrafts(), recentNews(12), recentRuns(5)]);
  const missing = [
    llmConfigured() ? "" : "DEEPSEEK_API_KEY (drafting)",
    zernioConfigured() ? "" : "ZERNIO_API_KEY (LinkedIn and Facebook)",
    uploadPostConfigured() ? "" : "UPLOAD_POST_API_KEY (Instagram and Pinterest)",
    process.env.CRON_SECRET ? "" : "CRON_SECRET (the scheduled run)",
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="Blog"
        desc="Every three days the pipeline reads the music tech press and writes one post from the story worth having a view on. A post that passes the checks goes live on its own. Anything the checks reject waits here for you, and you can edit or take down any post at any time."
        actions={<RunNow />}
      />

      <div className="int-stack">
        {missing.length ? (
          <p className="int-config-note">Not configured on this deployment: {missing.join(", ")}.</p>
        ) : null}

        {drafts.length === 0 ? (
          <EmptyState
            glyph="✎"
            title="No Drafts Yet"
            desc="The next scheduled run will leave one here, or press Run Now."
          />
        ) : (
          <div className="int-table-panel">
            <table className="gs-table int-table int-table-drafts">
              <colgroup>
                <col />
                <col className="int-col-from" />
                <col className="int-col-date" />
                <col className="int-col-status" />
                <col className="int-col-checks" />
              </colgroup>
              <thead>
                <tr>
                  <th>Post</th>
                  <th>From</th>
                  <th>Drafted</th>
                  <th>Status</th>
                  <th>Checks</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((d) => {
                  const errors = d.validation.errors?.length ?? 0;
                  return (
                    <tr key={d.id}>
                      <td className="int-td-main">
                        <Link href={`/internal/blog/${d.id}`} className="int-row-title">
                          {d.title}
                        </Link>
                        <div className="int-note">/blog/{d.slug}</div>
                      </td>
                      <td className="int-td-meta int-cell-tight">{d.news.source ?? ""}</td>
                      <td className="int-td-meta int-cell-mono">{day(d.createdAt)}</td>
                      <td className="int-td-meta">
                        <span className={`int-status-pill ${TONE[d.status]}`}>
                          <span className="int-status-dot" aria-hidden="true" />
                          {LABEL[d.status]}
                        </span>
                      </td>
                      <td className="int-td-meta">
                        <span className={`int-check ${errors ? "is-fail" : "is-pass"}`}>
                          <span className="int-status-dot" aria-hidden="true" />
                          {errors ? `${errors} to fix` : "Pass"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <section className="int-resource-section">
          <h2 className="int-section-title">What the Music Tech Press Is Talking About</h2>
          {news.length === 0 ? (
            <p className="int-module-desc">Nothing scanned yet.</p>
          ) : (
            <div className="int-table-panel">
              <table className="gs-table int-table int-table-news">
                <colgroup>
                  <col className="int-col-score" />
                  <col />
                  <col className="int-col-source" />
                  <col className="int-col-date" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Score</th>
                    <th>Story</th>
                    <th>Source</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {news.map((n) => (
                    <tr key={n.id}>
                      <td className="int-td-meta int-cell-mono int-td-score">{n.score ?? ""}</td>
                      <td className="int-td-main">
                        <a href={n.url} target="_blank" rel="noreferrer" className="int-row-title">
                          {n.title}
                        </a>
                        {n.reason ? <div className="int-note int-note-clamp">{n.reason}</div> : null}
                        {n.usedDraftId ? (
                          <div className="int-note">
                            <Link href={`/internal/blog/${n.usedDraftId}`}>Written up</Link>
                          </div>
                        ) : null}
                      </td>
                      <td className="int-td-meta int-cell-tight">{n.source}</td>
                      <td className="int-td-meta int-cell-mono">{day(n.publishedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {runs.length ? (
          <section className="int-resource-section">
            <h2 className="int-section-title">Recent Runs</h2>
            <div className="int-runs">
              {runs.map((r) => (
                <div key={r.id} className="int-run">
                  <span className="int-run-when int-cell-mono">
                    {r.startedAt.slice(0, 16).replace("T", " ")}
                  </span>
                  <span className="int-run-outcome">
                    {r.trigger} · {r.outcome}
                  </span>
                  <span className="int-run-detail">{r.detail}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
