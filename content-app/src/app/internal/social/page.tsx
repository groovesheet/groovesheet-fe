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

/* Filled status pills, the design system's job-status recipe. */
const TONE: Record<SocialStatus, string> = {
  draft: "is-draft",
  published: "is-published",
  failed: "is-failed",
};
const STATUS_LABEL: Record<SocialStatus, string> = {
  draft: "Draft",
  published: "Published",
  failed: "Failed",
};
const PLATFORM_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  pinterest: "Pinterest",
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
          title="No Social Posts Yet"
          desc="Captions are written alongside every blog draft. Edit them on the draft itself."
        />
      ) : (
        <div className="int-table-panel">
          <table className="gs-table int-table int-table-social">
            <colgroup>
              <col className="int-col-platform" />
              <col />
              <col className="int-col-post" />
              <col className="int-col-status" />
              <col className="int-col-action" />
            </colgroup>
            <thead>
              <tr>
                <th>Platform</th>
                <th>Caption</th>
                <th>Blog Post</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="int-td-meta int-td-platform">{PLATFORM_LABEL[s.platform] ?? s.platform}</td>
                  <td className="int-td-main">
                    <div className="int-caption">{s.content}</div>
                    {s.error && s.status === "failed" ? (
                      <div className="int-note int-note-error">{s.error}</div>
                    ) : null}
                  </td>
                  <td className="int-td-meta int-td-post">
                    <Link href={`/internal/blog/${s.draftId}`} className="int-row-title int-clamp-2">
                      {s.draftTitle}
                    </Link>
                    <div className="int-note">Blog: {s.draftStatus}</div>
                  </td>
                  <td className="int-td-meta">
                    <span className={`int-status-pill ${TONE[s.status]}`}>
                      <span className="int-status-dot" aria-hidden="true" />
                      {STATUS_LABEL[s.status]}
                    </span>
                    {s.publishedAt ? <div className="int-note">{s.publishedAt.slice(0, 10)}</div> : null}
                  </td>
                  <td className="int-td-meta int-td-action">
                    {s.status === "published" ? (
                      s.platformUrl ? (
                        <a href={s.platformUrl} target="_blank" rel="noreferrer">View</a>
                      ) : null
                    ) : s.draftStatus === "published" ? (
                      <PostNow id={s.id} label={s.status === "failed" ? "Try Again" : "Post Now"} />
                    ) : (
                      <span className="int-note">Waits for approval</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
