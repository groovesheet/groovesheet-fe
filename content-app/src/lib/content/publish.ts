/* Approval. The only code path that makes anything public.

   Order matters and is the same order scripts/syndicate.mjs insists on: the
   post goes live, the URL is proven to answer 200, and only then is it
   announced. A social post pointing at a 404 lands in front of exactly the
   audience the post was written for. */
import { revalidatePath } from "next/cache";
import cfg from "../../../scripts/pipeline.config.json";
import {
  getDraft,
  getSocial,
  reopenSocial,
  setDraftStatus,
  socialForDraft,
  socialResult,
} from "./store";
import { IMAGE_PLATFORMS, SOCIAL_LIMIT, type Draft, type SocialPost } from "./types";
import { publishImagePost } from "./uploadPost";
import { validateCaption, validateDraft } from "./validate";
import { publishNow, takeDown } from "./zernio";

export function postUrl(slug: string): string {
  return `${cfg.business.baseUrl}${cfg.content.urlPrefix}/${slug}`;
}

/* Everything that has to change the moment a post goes live or comes down.

   The topic hubs are here for a reason found the hard way: they are their own
   cached routes, so revalidating only /blog and the post itself left a brand
   new post missing from the very hub it was filed under, for up to the hourly
   window, while the index and the sitemap already showed it. A reader who
   clicked the topic pill under the post landed on a page that did not list it.

   The hubs are revalidated by ROUTE, not by path. They are generated from
   generateStaticParams with dynamicParams false, and for such a route
   revalidatePath("/blog/category/stem-separation") is accepted and does
   nothing: the literal form only matches a page Next resolved dynamically.
   Naming the segment and passing "page" is the documented way to reach every
   instance, and it costs one extra hub regeneration per publish, which is
   nine cheap pages.

   `categories` is unused for the same reason and kept off the signature. */
function refreshBlog(slug: string): void {
  revalidatePath(cfg.content.urlPrefix);
  revalidatePath(`${cfg.content.urlPrefix}/${slug}`);
  revalidatePath(`${cfg.content.urlPrefix}/category/[slug]`, "page");
  revalidatePath("/sitemap.xml");
}

async function isLive(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const ok = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) })
      .then((r) => r.status === 200)
      .catch(() => false);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 2500));
  }
  return false;
}

export type SocialOutcome = { platform: string; ok: boolean; message: string };

export async function publishSocialPost(s: SocialPost, draft: Draft): Promise<SocialOutcome> {
  if (s.status === "published") {
    return { platform: s.platform, ok: true, message: "already published" };
  }
  if (draft.status !== "published") {
    return { platform: s.platform, ok: false, message: "the blog post is not published yet" };
  }
  const url = postUrl(draft.slug);
  const content = s.content.includes("{url}")
    ? s.content.replaceAll("{url}", url)
    : IMAGE_PLATFORMS.includes(s.platform)
      ? s.content.trim() // No clickable links under an image; the pin carries its own.
      : `${s.content.trim()}\n\n${url}`;

  const problems = validateCaption(content, SOCIAL_LIMIT[s.platform]);
  if (problems.length) {
    const message = problems.join("; ");
    await socialResult(s.id, { ok: false, error: message });
    return { platform: s.platform, ok: false, message };
  }
  if (!(await isLive(url))) {
    const message = `${url} is not answering 200 yet. Nothing was posted. Retry from Social once the page loads.`;
    await socialResult(s.id, { ok: false, error: message });
    return { platform: s.platform, ok: false, message };
  }
  try {
    let posted: { zernioPostId: string | null; platformUrl: string | null };
    const image = draft.image.startsWith("/") ? `${cfg.business.baseUrl}${draft.image}` : draft.image;
    if (IMAGE_PLATFORMS.includes(s.platform)) {
      const r = await publishImagePost({
        platform: s.platform,
        caption: content,
        title: draft.title,
        imageUrl: image,
        link: url,
      });
      posted = { zernioPostId: r.postId, platformUrl: r.postUrl };
    } else {
      // Stable per row and per attempt at this content: a double click cannot double post.
      posted = await publishNow(s.platform, content, `groovesheet-social-${s.id}-${s.updatedAt}`, image);
    }
    await socialResult(s.id, { ok: true, ...posted });
    return { platform: s.platform, ok: true, message: posted.platformUrl ?? "published" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await socialResult(s.id, { ok: false, error: message });
    return { platform: s.platform, ok: false, message };
  }
}

export type ApproveResult =
  | { ok: true; url: string; social: SocialOutcome[] }
  | { ok: false; errors: string[] };

export async function approveDraft(id: number, by: string, withSocial: boolean): Promise<ApproveResult> {
  const draft = await getDraft(id);
  if (!draft) return { ok: false, errors: ["Draft not found"] };

  const { errors } = validateDraft(draft);
  if (errors.length) return { ok: false, errors };

  const published = await setDraftStatus(id, "published", by);
  if (!published) return { ok: false, errors: ["Draft disappeared while publishing"] };
  refreshBlog(published.slug);

  const social: SocialOutcome[] = [];
  if (withSocial) {
    for (const s of await socialForDraft(id)) {
      if (!s.enabled || s.status === "published") continue;
      social.push(await publishSocialPost(s, published));
    }
  }
  return { ok: true, url: postUrl(published.slug), social };
}

/** Takes the post off /blog. Social posts already sent are not recalled. */
export async function unpublishDraft(id: number): Promise<void> {
  const d = await setDraftStatus(id, "review", null);
  if (d) refreshBlog(d.slug);
}

export async function retrySocial(socialId: number): Promise<SocialOutcome> {
  const s = await getSocial(socialId);
  if (!s) return { platform: "", ok: false, message: "Social post not found" };
  const draft = await getDraft(s.draftId);
  if (!draft) return { platform: s.platform, ok: false, message: "Draft not found" };
  return publishSocialPost(s, draft);
}

export type ReopenResult = { ok: boolean; message: string };

/* Pull a sent social post back so it can be corrected and sent again.

   LinkedIn and Facebook come down through Zernio. Instagram and Pinterest
   cannot: neither network lets an API delete a post, so the row is reopened
   and the person is told to remove the original by hand, or there will be two. */
export async function reopenSocialPost(socialId: number): Promise<ReopenResult> {
  const s = await getSocial(socialId);
  if (!s) return { ok: false, message: "Social post not found" };
  if (s.status !== "published") {
    await reopenSocial(s.id);
    return { ok: true, message: "Ready to edit and send." };
  }
  if (IMAGE_PLATFORMS.includes(s.platform)) {
    await reopenSocial(s.id);
    return {
      ok: true,
      message: `Reopened. ${s.platform === "instagram" ? "Instagram" : "Pinterest"} does not let us delete a post for you: remove the old one in the app, then send this again.`,
    };
  }
  if (s.zernioPostId) {
    try {
      await takeDown(s.zernioPostId, s.platform);
    } catch (err) {
      return { ok: false, message: `Could not take it down, so nothing was changed. ${err instanceof Error ? err.message : err}` };
    }
  }
  await reopenSocial(s.id);
  return { ok: true, message: "Taken down. Edit the caption, then send it again." };
}
