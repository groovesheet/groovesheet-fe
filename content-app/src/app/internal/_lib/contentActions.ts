"use server";

/* Every write the content screens make: /internal/blog and /internal/social.

   Approval is the only path to anything public, and it is only reachable from
   here, behind the portal session. The cron and "Run now" can draft; they
   cannot publish. */
import { revalidatePath } from "next/cache";
import { getSession } from "./auth";
import { regenerateCaptions } from "@/lib/content/generate";
import {
  approveDraft,
  reopenSocialPost,
  retrySocial,
  unpublishDraft,
  type SocialOutcome,
} from "@/lib/content/publish";
import {
  deleteDraft,
  getDraft,
  setDraftStatus,
  slugTaken,
  updateDraft,
  updateSocial,
} from "@/lib/content/store";
import type { Faq } from "@/lib/content/types";
import { validateDraft } from "@/lib/content/validate";
import cfg from "../../../../scripts/pipeline.config.json";

export type ContentResult =
  | { ok: true; message?: string; social?: SocialOutcome[] }
  | { ok: false; errors: string[] };

async function caller(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in");
  return session.user;
}

function refresh(id?: number): void {
  revalidatePath("/internal/blog");
  revalidatePath("/internal/social");
  if (id) revalidatePath(`/internal/blog/${id}`);
}

export type DraftForm = {
  title: string;
  slug: string;
  description: string;
  summary: string;
  category: string;
  image: string;
  author: string;
  industry: string;
  categories: string[];
  seoKeyword: string;
  seoTitle: string;
  publishDate: string;
  faqs: Faq[];
  bodyMarkdown: string;
  social: { id: number; content: string; enabled: boolean }[];
};

export async function saveDraft(id: number, form: DraftForm): Promise<ContentResult> {
  await caller();
  const current = await getDraft(id);
  if (!current) return { ok: false, errors: ["Draft not found."] };

  const slug = form.slug.trim().toLowerCase();
  if (slug !== current.slug) {
    /* The URL of a live post has been announced. Changing it breaks the links
       in every social post that carried it. */
    if (current.status === "published") {
      return { ok: false, errors: ["Unpublish before changing the slug of a live post."] };
    }
    if (await slugTaken(slug, id)) return { ok: false, errors: [`The slug "${slug}" is in use.`] };
  }

  const faqs = form.faqs
    .map((f) => ({ q: f.q.trim(), a: f.a.trim() }))
    .filter((f) => f.q || f.a);
  const next = {
    title: form.title.trim(),
    slug,
    description: form.description.trim(),
    summary: form.summary.trim(),
    // The label shown on cards and in the hero is the first topic chosen.
    category:
      cfg.taxonomy.categories.find((k) => k.slug === form.categories[0])?.label ??
      (form.category.trim() || current.category),
    image: form.image.trim() || "/og.png",
    author: form.author.trim() || cfg.taxonomy.defaultAuthor,
    industry: cfg.taxonomy.industries.some((i) => i.slug === form.industry) ? form.industry : "",
    categories: form.categories.filter((c) => cfg.taxonomy.categories.some((k) => k.slug === c)),
    seoKeyword: form.seoKeyword.trim(),
    seoTitle: form.seoTitle.trim(),
    publishDate: /^\d{4}-\d{2}-\d{2}$/.test(form.publishDate) ? form.publishDate : null,
    faqs,
    bodyMarkdown: form.bodyMarkdown,
  };
  const validation = validateDraft(next);

  // A live post is never saved into a state the validator rejects.
  if (current.status === "published" && validation.errors.length) {
    return { ok: false, errors: validation.errors };
  }

  await updateDraft(id, { ...next, validation });
  for (const s of form.social) {
    await updateSocial(s.id, { content: s.content, enabled: s.enabled });
  }
  if (current.status === "published") {
    revalidatePath("/blog");
    revalidatePath(`/blog/${slug}`);
  }
  refresh(id);
  return {
    ok: true,
    message: validation.errors.length
      ? `Saved with ${validation.errors.length} issue(s) to fix before approval.`
      : "Saved.",
  };
}

export async function approve(id: number, form: DraftForm, withSocial: boolean): Promise<ContentResult> {
  const user = await caller();
  const saved = await saveDraft(id, form);
  if (!saved.ok) return saved;

  const result = await approveDraft(id, user, withSocial);
  refresh(id);
  if (!result.ok) return { ok: false, errors: result.errors };
  return { ok: true, message: `Live at ${result.url}`, social: result.social };
}

export async function unpublish(id: number): Promise<ContentResult> {
  await caller();
  await unpublishDraft(id);
  refresh(id);
  return { ok: true, message: "Taken off the blog. Social posts already sent are not recalled." };
}

export async function reject(id: number): Promise<ContentResult> {
  await caller();
  const d = await getDraft(id);
  if (d?.status === "published") return { ok: false, errors: ["Unpublish it first."] };
  await setDraftStatus(id, "rejected", null);
  refresh(id);
  return { ok: true, message: "Rejected." };
}

export async function removeDraft(id: number): Promise<ContentResult> {
  await caller();
  const d = await getDraft(id);
  if (d?.status === "published") return { ok: false, errors: ["Unpublish it first."] };
  await deleteDraft(id);
  refresh();
  return { ok: true };
}

export async function rewriteCaptions(id: number, form: DraftForm): Promise<ContentResult> {
  await caller();
  const saved = await saveDraft(id, form);
  if (!saved.ok) return saved;
  const d = await getDraft(id);
  if (!d) return { ok: false, errors: ["Draft not found."] };
  try {
    await regenerateCaptions(d);
  } catch (err) {
    return { ok: false, errors: [err instanceof Error ? err.message : String(err)] };
  }
  refresh(id);
  return { ok: true, message: "Captions rewritten from the current post." };
}

export async function publishSocial(socialId: number): Promise<ContentResult> {
  await caller();
  const r = await retrySocial(socialId);
  refresh();
  const name = r.platform ? r.platform[0].toUpperCase() + r.platform.slice(1) : "The network";
  return r.ok
    ? { ok: true, message: `Posted to ${name}.`, social: [r] }
    : { ok: false, errors: [`${name} did not accept it: ${r.message}`] };
}

export async function reopenSocial(socialId: number): Promise<ContentResult> {
  await caller();
  const r = await reopenSocialPost(socialId);
  refresh();
  return r.ok ? { ok: true, message: r.message } : { ok: false, errors: [r.message] };
}
