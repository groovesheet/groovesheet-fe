import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "../_components/PageHeader";
import EmptyState from "../_components/EmptyState";
import { hasDatabase } from "@/lib/content/db";
import { listSocial } from "@/lib/content/store";
import type { SocialStatus } from "@/lib/content/types";
import PostNow from "./PostNow";

export const metadata: Metadata = {
  title: "Social",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TONE: Record<SocialStatus, string> = {
  draft: "var(--muted)",
  published: "var(--semantic-up)",
  failed: "var(--semantic-down)",
};

export default async function SocialPage() {
  const rows = hasDatabase() ? await listSocial() : [];

  return (
    <>
      <PageHeader
        title="Social"
        desc="The LinkedIn, Facebook, Instagram and Pinterest posts written from each blog post. They go out when the post is approved, and anything that failed can be sent again from here."
      />

      {rows.length === 0 ? (
        <EmptyState
          glyph="◎"
          title="No social posts yet"
          desc="Captions are written alongside every blog draft. Edit them on the draft itself."
        />
      ) : (
        <div className="int-table-panel">
          <div className="int-table-scroll">
            <table className="gs-table" style={{ minWidth: 1000 }}>
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Platform</th>
                  <th>Caption</th>
                  <th style={{ width: 260 }}>Blog post</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 200 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td style={{ textTransform: "capitalize", color: "var(--ink)" }}>{s.platform}</td>
                    <td className="int-cell-tight">
                      <div style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-line" }}>
                        {s.content}
                      </div>
                      {s.error && s.status === "failed" ? (
                        <div className="int-note" style={{ color: "var(--semantic-down)", whiteSpace: "normal" }}>{s.error}</div>
                      ) : null}
                    </td>
                    <td className="int-cell-tight">
                      <Link href={`/internal/blog/${s.draftId}`}>{s.draftTitle}</Link>
                      <div className="int-note">blog: {s.draftStatus}</div>
                    </td>
                    <td>
                      <span className="gs-badge" style={{ color: TONE[s.status], fontSize: 11 }}>
                        {s.status}
                      </span>
                      {s.publishedAt ? <div className="int-note">{s.publishedAt.slice(0, 10)}</div> : null}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {s.status === "published" ? (
                        s.platformUrl ? (
                          <a href={s.platformUrl} target="_blank" rel="noreferrer">View</a>
                        ) : null
                      ) : s.draftStatus === "published" ? (
                        <PostNow id={s.id} label={s.status === "failed" ? "Try again" : "Post now"} />
                      ) : (
                        <span className="int-note">waits for approval</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
