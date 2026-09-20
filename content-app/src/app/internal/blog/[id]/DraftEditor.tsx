"use client";

/* The post editor. Laid out the way a CMS editor is: the title and the rich
   text body take the wide column, and everything that describes the post
   (address, excerpt, cover, byline, audience, topics, search fields, date)
   sits in a panel beside it, followed by approval and the social captions. */
import cfg from "../../../../../scripts/pipeline.config.json";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import RichTextEditor from "../../_components/RichTextEditor";
import {
  approve,
  removeDraft,
  rewriteCaptions,
  saveDraft,
  unpublish,
  publishSocial,
  reopenSocial,
  type ContentResult,
  type DraftForm,
} from "../../_lib/contentActions";
import { SOCIAL_ICONS } from "@/components/socialIcons";
import { SOCIAL_LIMIT, type Draft, type SocialPost } from "@/lib/content/types";

type Option = { slug: string; label: string };
type Limits = { title: number; descMin: number; descMax: number; summary: number };

const PLATFORM_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  pinterest: "Pinterest",
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

/* Where each social post stands, as one tile per network. A sent post is a
   link to it. One that failed, or has not gone out, is a button that sends it
   now, and says why it failed underneath. */
function SocialTiles({
  social,
  pending,
  sendingId,
  onPost,
}: {
  social: SocialPost[];
  pending: boolean;
  sendingId: number | null;
  onPost: (id: number) => void;
}) {
  if (social.length === 0) return null;
  const failed = social.filter((s) => s.status === "failed" && s.error);
  const tile: React.CSSProperties = {
    width: 44,
    height: 44,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid var(--hairline)",
    borderRadius: "var(--radius-sm, 6px)",
    background: "transparent",
    padding: 0,
  };
  return (
    <div className="int-form-field" style={{ gap: 8 }}>
      <div className="int-card-head">
        <span className="int-form-label">Social posts</span>
        <span className="int-tip" tabIndex={0} aria-label="What the colours mean">
          <Info size={15} aria-hidden="true" />
          <span className="int-tip-body" role="tooltip">
            Blue is live: click to open the post. Red failed and dashed grey has not gone out: click
            either to send it now.
          </span>
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {social.map((s) => {
          const icon = SOCIAL_ICONS[s.platform];
          const name = PLATFORM_LABEL[s.platform] ?? s.platform;
          const glyph = (
            <svg viewBox={icon.viewBox} width={18} height={18} fill="currentColor" aria-hidden="true" focusable="false">
              <path d={icon.path} />
            </svg>
          );
          if (s.status === "published") {
            return s.platformUrl ? (
              <a key={s.id} href={s.platformUrl} target="_blank" rel="noreferrer" title={`Open the ${name} post`} aria-label={`Open the ${name} post`} style={{ ...tile, color: "var(--primary)", borderColor: "var(--primary)" }}>
                {glyph}
              </a>
            ) : (
              <span key={s.id} title={`Sent to ${name}. The network gave no link back.`} aria-label={`Sent to ${name}`} style={{ ...tile, color: "var(--primary)", borderColor: "var(--primary)" }}>
                {glyph}
              </span>
            );
          }
          const bad = s.status === "failed";
          if (sendingId === s.id) {
            return (
              <span key={s.id} aria-label={`Sending to ${name}`} style={{ ...tile, color: "var(--primary)", borderColor: "var(--primary)" }}>
                <span className="int-spinner" aria-hidden="true" />
              </span>
            );
          }
          return (
            <button
              key={s.id}
              type="button"
              disabled={pending}
              onClick={() => onPost(s.id)}
              title={bad ? `${name} failed. Click to try again.` : `Not sent. Click to post to ${name} now.`}
              aria-label={bad ? `Retry ${name}` : `Post to ${name} now`}
              style={{
                ...tile,
                cursor: "pointer",
                color: bad ? "var(--semantic-down)" : "var(--muted-soft)",
                borderColor: bad ? "var(--semantic-down)" : "var(--hairline)",
                borderStyle: bad ? "solid" : "dashed",
              }}
            >
              {glyph}
            </button>
          );
        })}
      </div>
      {sendingId !== null ? (
        <span className="int-form-hint" role="status" style={{ color: "var(--primary)", fontWeight: 600 }}>
          Sending to {PLATFORM_LABEL[social.find((x) => x.id === sendingId)?.platform ?? ""] ?? "the network"}. This can take up to a minute, stay on this page.
        </span>
      ) : null}
      {failed.map((s) => (
        <span key={s.id} className="int-form-hint" style={{ color: "var(--semantic-down)", overflowWrap: "anywhere" }}>
          {PLATFORM_LABEL[s.platform] ?? s.platform}: {s.error}
        </span>
      ))}
    </div>
  );
}

function Field({
  label,
  hint,
  bad,
  children,
}: {
  label: string;
  hint?: string;
  bad?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="int-form-field">
      <div className="int-card-head">
        <span className="int-form-label">{label}</span>
        {hint ? (
          <span className="int-form-hint" style={bad ? { color: "var(--semantic-down)" } : undefined}>
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export default function DraftEditor({
  draft,
  social,
  limits,
  liveUrl,
  siteHost,
  categories,
  industries,
  authors,
  keywords,
  keywordMarket,
}: {
  draft: Draft;
  social: SocialPost[];
  limits: Limits;
  liveUrl: string;
  siteHost: string;
  categories: Option[];
  industries: Option[];
  authors: string[];
  keywords: { keyword: string; volume: number }[];
  /** Where the volumes were measured, e.g. "US, UK, CA and AU". */
  keywordMarket: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<DraftForm>({
    title: draft.title,
    slug: draft.slug,
    description: draft.description,
    summary: draft.summary,
    category: draft.category,
    image: draft.image,
    author: draft.author || authors[0] || "",
    industry: draft.industry,
    categories: draft.categories,
    seoKeyword: draft.seoKeyword,
    seoTitle: draft.seoTitle,
    publishDate: draft.publishDate ?? "",
    faqs: draft.faqs.length ? draft.faqs : [{ q: "", a: "" }],
    bodyMarkdown: draft.bodyMarkdown,
    social: social.map((s) => ({ id: s.id, content: s.content, enabled: s.enabled })),
  });
  const [withSocial, setWithSocial] = useState(true);
  /** The social post being sent right now, so its tile can say so. */
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [result, setResult] = useState<ContentResult | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState("");

  const live = draft.status === "published";
  const set = <K extends keyof DraftForm>(k: K, v: DraftForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  function act(fn: () => Promise<ContentResult>, after?: () => void) {
    setResult(null);
    start(async () => {
      try {
        const r = await fn();
        setResult(r);
        if (r.ok) {
          if (after) after();
          else router.refresh();
        } else {
          // A failed send still changed the row (status, reason): show it.
          router.refresh();
        }
      } catch (err) {
        setResult({ ok: false, errors: [err instanceof Error ? err.message : "Something went wrong."] });
      } finally {
        setSendingId(null);
      }
    });
  }

  async function uploadCover(file: File | undefined) {
    if (!file) return;
    setCoverError("");
    setCoverBusy(true);
    try {
      const fd = new FormData();
      fd.set("image", file);
      const res = await fetch("/api/internal/content/image", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed.");
      set("image", json.url);
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setCoverBusy(false);
    }
  }

  const words = useMemo(
    () => form.bodyMarkdown.trim().split(/\s+/).filter(Boolean).length,
    [form.bodyMarkdown],
  );
  const keywordInBody =
    !form.seoKeyword || form.bodyMarkdown.toLowerCase().includes(form.seoKeyword.toLowerCase());
  const measuredHit = keywords.find((k) => k.keyword === form.seoKeyword.trim().toLowerCase());
  /* The suffix is content.titleSuffix, not a literal: the search preview is
     supposed to show what Google will actually print, and Next appends the
     title template from the root layout. Hard-coding it here is how a preview
     ends up advertising the wrong company. */
  const serpTitle = (form.seoTitle || form.title || "Post title") + cfg.content.titleSuffix;

  return (
    <div className="int-detail">
      {/* Main column: title, body, FAQs */}
      <div className="int-detail-main">
        <input
          className="gs-input"
          style={{ fontSize: 20, fontWeight: 600, height: 56 }}
          placeholder="Post title"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          aria-label="Post title"
        />
        <div className="int-card-head" style={{ marginTop: -12 }}>
          <span className="int-form-hint">{words} words</span>
          <span
            className="int-form-hint"
            style={form.title.length > limits.title ? { color: "var(--semantic-down)" } : undefined}
          >
            Title {form.title.length}/{limits.title}
          </span>
        </div>

        <RichTextEditor value={form.bodyMarkdown} onChange={(md) => set("bodyMarkdown", md)} />

        <div className="int-form-card">
          <div className="int-card-head">
            <span className="gs-caption-strong">FAQs</span>
            <span className="int-form-hint">Shown under the post and sent to search engines as FAQ data</span>
          </div>
          {form.faqs.map((f, i) => (
            <div key={i} className="int-form-field" style={{ gap: 8 }}>
              <input
                className="gs-input"
                placeholder="Question"
                value={f.q}
                onChange={(e) => set("faqs", form.faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))}
              />
              <textarea
                className="gs-input"
                style={{ minHeight: 80 }}
                placeholder="Answer"
                value={f.a}
                onChange={(e) => set("faqs", form.faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}
              />
              <button
                type="button"
                className="gs-btn gs-btn--tertiary-text"
                style={{ alignSelf: "flex-start", padding: 0 }}
                onClick={() => set("faqs", form.faqs.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="gs-btn gs-btn--secondary-light int-btn-sm"
            style={{ alignSelf: "flex-start" }}
            onClick={() => set("faqs", [...form.faqs, { q: "", a: "" }])}
          >
            Add a question
          </button>
        </div>
      </div>

      {/* Side panel: metadata, approval, social */}
      <div className="int-detail-side">
        <div className="int-form-card">
          <span className="gs-caption-strong">{live ? "Live" : "Approval"}</span>
          {live ? (
            <a href={liveUrl} target="_blank" rel="noreferrer" style={{ overflowWrap: "anywhere", fontSize: 13.5 }}>
              {liveUrl.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          ) : (
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5, color: "var(--body)" }}>
              <input type="checkbox" checked={withSocial} onChange={(e) => setWithSocial(e.target.checked)} style={{ marginTop: 3 }} />
              Send the ticked social posts as soon as the page is live
            </label>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {live ? null : (
              <button
                type="button"
                className="gs-btn gs-btn--primary int-btn-sm"
                disabled={pending}
                onClick={() => act(() => approve(draft.id, form, withSocial))}
              >
                {pending ? "Publishing, then sending social…" : "Approve and publish"}
              </button>
            )}
            <button
              type="button"
              className="gs-btn gs-btn--secondary-light int-btn-sm"
              disabled={pending}
              onClick={() => act(() => saveDraft(draft.id, form))}
            >
              {live ? "Update post" : "Save draft"}
            </button>
            {live ? (
              <button
                type="button"
                className="gs-btn gs-btn--secondary-light int-btn-sm"
                disabled={pending}
                onClick={() => {
                  if (window.confirm("Take this post off the blog? Social posts already sent stay up.")) {
                    act(() => unpublish(draft.id));
                  }
                }}
              >
                Unpublish
              </button>
            ) : null}
            {live ? null : (
              <button
                type="button"
                className="gs-btn gs-btn--secondary-light int-btn-sm"
                style={{ border: "1px solid var(--semantic-down)", color: "var(--semantic-down)", background: "transparent" }}
                disabled={pending}
                onClick={() => {
                  if (window.confirm("Delete this draft and its captions? This cannot be undone.")) {
                    act(() => removeDraft(draft.id), () => router.push("/internal/blog"));
                  }
                }}
              >
                Delete
              </button>
            )}
          </div>
          {live ? (
            <SocialTiles
              social={social}
              pending={pending}
              sendingId={sendingId}
              onPost={(id) => {
                setSendingId(id);
                act(() => publishSocial(id));
              }}
            />
          ) : null}

          {result ? (
            result.ok ? (
              result.message ? (
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--semantic-up)", overflowWrap: "anywhere" }} role="status">
                  {result.message.startsWith("Live at") ? "Published. The icons above show each social post." : result.message}
                </div>
              ) : null
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--semantic-down)", overflowWrap: "anywhere" }} role="alert">
                {result.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )
          ) : null}
        </div>

        <div className="int-form-card">
          <Field label="Slug" hint={live ? "locked while live" : undefined}>
            <input
              className="gs-input"
              style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
              value={form.slug}
              disabled={live}
              onChange={(e) => set("slug", e.target.value)}
              onBlur={() => set("slug", slugify(form.slug || form.title))}
            />
            <span className="int-form-hint">/blog/{form.slug || "…"}</span>
          </Field>

          <Field label="Excerpt" hint={`${form.summary.length}/${limits.summary}`} bad={form.summary.length > limits.summary}>
            <textarea className="gs-input" style={{ minHeight: 84 }} value={form.summary} onChange={(e) => set("summary", e.target.value)} />
          </Field>

          <Field label="Cover image" hint="Max 4 MB. Also used for Instagram and Pinterest.">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={form.image || "/og.png"}
              alt=""
              style={{ width: "100%", aspectRatio: "1200 / 630", objectFit: "cover", border: "1px solid var(--hairline)" }}
            />
            <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" disabled={coverBusy} onChange={(e) => uploadCover(e.target.files?.[0])} style={{ fontSize: 13 }} />
            {coverBusy ? <span className="int-form-hint">Uploading…</span> : null}
            {coverError ? <span className="int-form-hint" style={{ color: "var(--semantic-down)" }}>{coverError}</span> : null}
          </Field>

          <Field label="Author">
            <div className="int-select-wrap int-select-full">
              <select className="int-select" value={form.author} onChange={(e) => set("author", e.target.value)}>
                {[...new Set([form.author, ...authors])].filter(Boolean).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </Field>

          <Field label="Industry" hint="Who it is for">
            <div className="int-select-wrap int-select-full">
              <select className="int-select" value={form.industry} onChange={(e) => set("industry", e.target.value)}>
                <option value="">None, it is general</option>
                {industries.map((i) => (
                  <option key={i.slug} value={i.slug}>{i.label}</option>
                ))}
              </select>
            </div>
          </Field>

          <Field label="Categories" hint="First one is the main topic">
            <div className="int-chip-row">
              {categories.map((c) => {
                const on = form.categories.includes(c.slug);
                return (
                  <button
                    key={c.slug}
                    type="button"
                    className={`int-chip${on ? " is-on" : ""}`}
                    aria-pressed={on}
                    onClick={() =>
                      set("categories", on ? form.categories.filter((x) => x !== c.slug) : [...form.categories, c.slug])
                    }
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        <div className="int-form-card">
          <span className="gs-caption-strong">Search</span>
          <Field
            label="SEO keyword"
            hint={
              form.seoKeyword
                ? `${measuredHit ? `${measuredHit.volume.toLocaleString("en-US")} searches a month in ${keywordMarket}` : "not a measured keyword"}, ${keywordInBody ? "used in the body" : "not in the body yet"}`
                : "Pick a measured keyword, or type your own"
            }
            bad={!keywordInBody}
          >
            <input className="gs-input" list="measured-keywords" placeholder="e.g. audio to sheet music" value={form.seoKeyword} onChange={(e) => set("seoKeyword", e.target.value)} />
            <datalist id="measured-keywords">
              {keywords.map((k) => (
                <option key={k.keyword} value={k.keyword}>{`${k.volume.toLocaleString("en-US")} / month`}</option>
              ))}
            </datalist>
          </Field>
          <Field label="SEO title" hint={`${form.seoTitle.length}/60`} bad={form.seoTitle.length > 60}>
            <input className="gs-input" placeholder="Defaults to the post title" value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
          </Field>
          <Field
            label="Meta description"
            hint={`${form.description.length}/${limits.descMax}`}
            bad={form.description.length > limits.descMax || form.description.length < limits.descMin}
          >
            <textarea className="gs-input" style={{ minHeight: 84 }} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <div className="int-serp" aria-label="Search result preview">
            <span className="int-serp-url">{siteHost}/blog/{form.slug}</span>
            <span className="int-serp-title">{serpTitle}</span>
            <span className="int-serp-desc">{form.description || form.summary}</span>
          </div>
          <Field label="Publish date" hint="Blank means the day you approve it">
            <input type="date" className="gs-input" value={form.publishDate} onChange={(e) => set("publishDate", e.target.value)} />
          </Field>
        </div>

        {form.social.map((s, i) => {
          const row = social.find((x) => x.id === s.id);
          if (!row) return null;
          const sent = row.status === "published";
          const over = s.content.length > SOCIAL_LIMIT[row.platform];
          return (
            <div key={s.id} className="int-form-card">
              <div className="int-card-head">
                <span className="gs-caption-strong">{PLATFORM_LABEL[row.platform] ?? row.platform}</span>
                <span className="gs-badge" style={{ fontSize: 11, color: sent ? "var(--semantic-up)" : row.status === "failed" ? "var(--semantic-down)" : "var(--muted)" }}>
                  {row.status}
                </span>
              </div>
              <textarea
                className="gs-input"
                style={{ minHeight: row.platform === "linkedin" ? 320 : row.platform === "pinterest" ? 120 : 180, fontSize: 13.5 }}
                value={s.content}
                disabled={sent}
                onChange={(e) => set("social", form.social.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)))}
              />
              <div className="int-card-head">
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--body)" }}>
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    disabled={sent}
                    onChange={(e) => set("social", form.social.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))}
                  />
                  Post this one
                </label>
                <span className="int-form-hint" style={over ? { color: "var(--semantic-down)" } : undefined}>
                  {s.content.length}/{SOCIAL_LIMIT[row.platform]}
                </span>
              </div>
              {row.error && !sent ? <div style={{ fontSize: 12.5, color: "var(--semantic-down)" }}>{row.error}</div> : null}
              {sent ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {row.platformUrl ? (
                    <a className="gs-btn gs-btn--secondary-light int-btn-sm" href={row.platformUrl} target="_blank" rel="noreferrer">
                      View the post
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="gs-btn gs-btn--secondary-light int-btn-sm"
                    disabled={pending}
                    onClick={() => {
                      const manual = row.platform === "instagram" || row.platform === "pinterest";
                      const name = PLATFORM_LABEL[row.platform] ?? row.platform;
                      const ask = manual
                        ? `Reopen the ${name} post to fix and resend it? ${name} does not let us delete posts, so remove the old one in the app yourself or there will be two.`
                        : `Take the ${name} post down so you can fix and resend it?`;
                      if (window.confirm(ask)) act(() => reopenSocial(s.id));
                    }}
                  >
                    {row.platform === "instagram" || row.platform === "pinterest" ? "Fix and repost" : "Take down and repost"}
                  </button>
                </div>
              ) : null}
              {live && !sent ? (
                <button
                  type="button"
                  className="gs-btn gs-btn--secondary-light int-btn-sm"
                  style={{ alignSelf: "flex-start" }}
                  disabled={pending}
                  onClick={() =>
                    act(async () => {
                      const saved = await saveDraft(draft.id, form);
                      return saved.ok ? publishSocial(s.id) : saved;
                    })
                  }
                >
                  Post to {PLATFORM_LABEL[row.platform] ?? row.platform} now
                </button>
              ) : null}
            </div>
          );
        })}

        {social.some((s) => s.status !== "published") || social.length === 0 ? (
          <button
            type="button"
            className="gs-btn gs-btn--tertiary-text"
            style={{ padding: 0, alignSelf: "flex-start" }}
            disabled={pending}
            onClick={() => act(() => rewriteCaptions(draft.id, form), () => window.location.reload())}
          >
            Rewrite the captions from the current post
          </button>
        ) : null}
        <p className="int-resource-note" style={{ margin: 0 }}>
          The token {"{url}"} in a caption becomes the post&apos;s address when it is sent. Instagram
          and Pinterest go out with the cover image, and the pin links to the post by itself.
        </p>
      </div>
    </div>
  );
}
