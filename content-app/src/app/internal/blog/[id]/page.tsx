import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "../../_components/PageHeader";
import cfg from "../../../../../scripts/pipeline.config.json";
import { postUrl } from "@/lib/content/publish";
import { completeDraft, draftGaps } from "@/lib/content/generate";
import { llmConfigured } from "@/lib/content/llm";
import { getDraft, socialForDraft } from "@/lib/content/store";
import measured from "../../../../../content/seo-keywords.json";
import { validateDraft } from "@/lib/content/validate";
import DraftEditor from "./DraftEditor";

export const metadata: Metadata = {
  title: "Review post",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
// Approval waits for the page to answer 200, then posts to two platforms.
export const maxDuration = 120;

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let draft = /^\d+$/.test(id) ? await getDraft(Number(id)) : null;
  if (!draft) notFound();
  let social = await socialForDraft(draft.id);

  /* A draft written before a platform or a field existed is filled in here,
     once, the first time someone opens it. Never a reason to fail the page. */
  if (draft.status !== "published" && llmConfigured() && draftGaps(draft, social.map((s) => s.platform)).length) {
    try {
      await completeDraft(draft.id);
      draft = (await getDraft(draft.id)) ?? draft;
      social = await socialForDraft(draft.id);
    } catch (err) {
      console.error("[content] backfill failed:", err instanceof Error ? err.message : err);
    }
  }

  const { errors, warnings } = validateDraft(draft);

  return (
    <>
      <PageHeader
        title={draft.title}
        desc={
          draft.news.title
            ? `Written from "${draft.news.title}" (${draft.news.source ?? "source"}). Model: ${draft.model}.`
            : undefined
        }
        actions={
          <>
            <a
              className="gs-btn gs-btn--secondary-light int-btn-sm"
              href={`/internal/blog/${draft.id}/preview`}
              target="_blank"
              rel="noreferrer"
            >
              Preview Saved Version
            </a>
            <Link className="gs-btn gs-btn--secondary-light int-btn-sm" href="/internal/blog">
              All Posts
            </Link>
          </>
        }
      />

      <div className="int-stack">
        {errors.length || warnings.length ? (
          <div className="int-callout">
            {errors.length ? (
              <>
                <span className="int-callout-title is-error">Fix Before Approval</span>
                <ul className="int-callout-list">
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {warnings.length ? (
              <>
                <span className="int-callout-title">Check by Eye</span>
                <ul className="int-callout-list">
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}

        <DraftEditor
          draft={draft}
          social={social}
          liveUrl={postUrl(draft.slug)}
          siteHost={cfg.business.baseUrl.replace(/^https?:\/\//, "")}
          categories={cfg.taxonomy.categories.map(({ slug, label }) => ({ slug, label }))}
          industries={cfg.taxonomy.industries}
          authors={cfg.taxonomy.authors}
          keywords={measured.keywords.map(({ keyword, volume }) => ({ keyword, volume }))}
          keywordMarket={measured.market}
          limits={{
            title: cfg.validation.titleMaxChars,
            descMin: cfg.validation.descriptionMinChars,
            descMax: cfg.validation.descriptionMaxChars,
            summary: cfg.validation.summaryMaxChars,
          }}
        />

      </div>
    </>
  );
}
