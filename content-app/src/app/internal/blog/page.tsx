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

const TONE: Record<DraftStatus, string> = {
  review: "var(--primary)",
  published: "var(--semantic-up)",
  rejected: "var(--muted-soft)",
};
const LABEL: Record<DraftStatus, string> = {
  review: "needs review",
  published: "published",
  rejected: "rejected",
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
          title="No database"
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
        desc="Every three days the pipeline reads the music tech press, drafts one post from the story worth having a view on, and holds it here. Nothing goes public until you approve it."
        actions={<RunNow />}
      />

      <div className="int-stack">
        {missing.length ? (
          <p className="int-resource-note">Not configured on this deployment: {missing.join(", ")}.</p>
        ) : null}

        {drafts.length === 0 ? (
          <EmptyState
            glyph="✎"
            title="No drafts yet"
            desc="The next scheduled run will leave one here, or press Run now."
          />
        ) : (
          <div className="int-table-panel">
            <div className="int-table-scroll">
              <table className="gs-table" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>Post</th>
                    <th style={{ width: 220 }}>From</th>
                    <th style={{ width: 120 }}>Drafted</th>
                    <th style={{ width: 130 }}>Status</th>
                    <th style={{ width: 90 }}>Checks</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d) => {
                    const errors = d.validation.errors?.length ?? 0;
                    return (
                      <tr key={d.id}>
                        <td className="int-cell-tight">
                          <Link href={`/internal/blog/${d.id}`} style={{ color: "var(--ink)", fontWeight: 600 }}>
                            {d.title}
                          </Link>
                          <div className="int-note">/blog/{d.slug}</div>
                        </td>
                        <td className="int-cell-tight">{d.news.source ?? ""}</td>
                        <td className="spec-value int-cell-mono">{day(d.createdAt)}</td>
                        <td>
                          <span className="gs-badge" style={{ color: TONE[d.status], fontSize: 11 }}>
                            {LABEL[d.status]}
                          </span>
                        </td>
                        <td className="spec-value int-cell-mono" style={{ color: errors ? "var(--semantic-down)" : "var(--semantic-up)" }}>
                          {errors ? `${errors} to fix` : "pass"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <section className="int-resource-section">
          <span className="gs-caption-strong">What the music tech press is talking about</span>
          {news.length === 0 ? (
            <p className="int-module-desc">Nothing scanned yet.</p>
          ) : (
            <div className="int-table-panel">
              <div className="int-table-scroll">
                <table className="gs-table" style={{ minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>Score</th>
                      <th>Story</th>
                      <th style={{ width: 200 }}>Source</th>
                      <th style={{ width: 110 }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {news.map((n) => (
                      <tr key={n.id}>
                        <td className="spec-value int-cell-mono">{n.score ?? ""}</td>
                        <td className="int-cell-tight">
                          <a href={n.url} target="_blank" rel="noreferrer" style={{ color: "var(--ink)" }}>
                            {n.title}
                          </a>
                          {n.reason ? <div className="int-note">{n.reason}</div> : null}
                          {n.usedDraftId ? (
                            <div className="int-note">
                              <Link href={`/internal/blog/${n.usedDraftId}`}>Written up</Link>
                            </div>
                          ) : null}
                        </td>
                        <td className="int-cell-tight">{n.source}</td>
                        <td className="spec-value int-cell-mono">{day(n.publishedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {runs.length ? (
          <section className="int-resource-section">
            <span className="gs-caption-strong">Recent runs</span>
            <div className="int-card-stack" style={{ gap: 8 }}>
              {runs.map((r) => (
                <div key={r.id} className="int-field" style={{ justifyContent: "flex-start" }}>
                  <span className="int-field-label int-cell-mono" style={{ width: 150 }}>
                    {r.startedAt.slice(0, 16).replace("T", " ")}
                  </span>
                  <span className="int-field-label" style={{ width: 90 }}>
                    {r.trigger} · {r.outcome}
                  </span>
                  <span style={{ color: "var(--body)" }}>{r.detail}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
