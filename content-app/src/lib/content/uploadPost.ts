/* Upload-Post: Instagram and Pinterest. https://docs.upload-post.com

   Same request shape as scripts/syndicate.mjs. Both networks are image-first:
   Upload-Post only reaches them through /upload_photos, so every post needs a
   public image URL. This is GrooveSheet's own Upload-Post workspace. */
import type { SocialPlatform } from "./types";

const BASE = "https://api.upload-post.com/api";

export function uploadPostConfigured(): boolean {
  return Boolean(process.env.UPLOAD_POST_API_KEY);
}

function auth(): Record<string, string> {
  return { Authorization: `Apikey ${process.env.UPLOAD_POST_API_KEY}` };
}

type Profile = { username?: string; social_accounts?: Record<string, unknown> };

/** The profile to post as, and proof the network is connected to it. */
async function profileFor(platform: SocialPlatform): Promise<string> {
  const res = await fetch(`${BASE}/uploadposts/users`, { headers: auth(), signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Upload-Post profile lookup failed: ${res.status}`);
  const json = (await res.json()) as { profiles?: Profile[] };
  const wanted = process.env.UPLOAD_POST_USER;
  const profile = (json.profiles ?? []).find((p) => (wanted ? p.username === wanted : true));
  if (!profile?.username) throw new Error("No Upload-Post profile found");
  if (!profile.social_accounts?.[platform]) {
    throw new Error(
      `${platform} is not connected to the Upload-Post profile "${profile.username}". Connect it in the Upload-Post dashboard, then try again.`,
    );
  }
  return profile.username;
}

async function pinterestBoard(profile: string): Promise<string> {
  if (process.env.UPLOAD_POST_PINTEREST_BOARD_ID) return process.env.UPLOAD_POST_PINTEREST_BOARD_ID;
  const res = await fetch(`${BASE}/uploadposts/pinterest/boards?profile=${encodeURIComponent(profile)}`, {
    headers: auth(),
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({}))) as { boards?: { id?: string }[] };
  const id = json.boards?.[0]?.id;
  if (!id) {
    throw new Error("The Pinterest account has no boards. Create one on Pinterest (for example \"Sheet music and transcription\"), then try again.");
  }
  return id;
}

export type ImagePost = {
  platform: SocialPlatform;
  caption: string;
  title: string;
  imageUrl: string;
  link: string;
};

export async function publishImagePost(p: ImagePost): Promise<{ postId: string | null; postUrl: string | null }> {
  if (!uploadPostConfigured()) throw new Error("UPLOAD_POST_API_KEY is not set");
  const profile = await profileFor(p.platform);

  const form = new FormData();
  form.set("user", profile);
  form.append("platform[]", p.platform);
  form.append("photos[]", p.imageUrl);
  if (p.platform === "instagram") {
    /* Instagram takes its caption from the generic `title`. The documented
       override, `instagram_title`, is recorded by Upload-Post and then not
       used: the first post went out captioned with the bare post title. So
       the caption goes in both. */
    form.set("title", p.caption);
    form.set("instagram_title", p.caption);
    form.set("media_type", "IMAGE");
  } else {
    form.set("title", p.title);
    form.set("pinterest_title", p.title.slice(0, 100));
    form.set("pinterest_description", p.caption);
    form.set("pinterest_board_id", await pinterestBoard(profile));
    form.set("pinterest_link", p.link);
    form.set("pinterest_alt_text", p.title.slice(0, 500));
  }

  const res = await fetch(`${BASE}/upload_photos`, {
    method: "POST",
    headers: auth(),
    body: form,
    signal: AbortSignal.timeout(90000),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Upload-Post ${res.status}: ${raw.slice(0, 400)}`);
  type Result = { success?: boolean; url?: string; post_id?: string; error?: string };
  const json = JSON.parse(raw) as { success?: boolean; request_id?: string; results?: Record<string, Result> };
  const mine = json.results?.[p.platform];
  if (json.success === false || mine?.success === false) {
    throw new Error(`${p.platform} rejected the post: ${mine?.error ?? raw.slice(0, 300)}`);
  }
  if (mine?.url || mine?.post_id) {
    return { postId: mine.post_id ?? null, postUrl: publicUrl(p.platform, mine.url, mine.post_id) };
  }

  /* No result in the reply means Upload-Post took the job and is doing it in
     the background. The outcome, and the only copy of the post's address, is
     on the status endpoint, so wait for it rather than calling an accepted
     job a published post. */
  if (json.request_id) {
    const done = await waitForJob(json.request_id, p.platform);
    if (done) return done;
    return { postId: json.request_id, postUrl: null };
  }
  return { postId: null, postUrl: null };
}

/** Upload-Post answers Pinterest with the pin's destination link, not the pin. */
function publicUrl(platform: SocialPlatform, url?: string | null, postId?: string | null): string | null {
  if (platform === "pinterest" && postId && /^\d+$/.test(postId)) return `https://www.pinterest.com/pin/${postId}/`;
  return url ?? null;
}

type JobResult = {
  platform?: string;
  success?: boolean;
  post_url?: string | null;
  platform_post_id?: string | null;
  error_message?: string | null;
};

async function waitForJob(
  requestId: string,
  platform: SocialPlatform,
): Promise<{ postId: string | null; postUrl: string | null } | null> {
  for (let attempt = 0; attempt < 12; attempt++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(`${BASE}/uploadposts/status?request_id=${encodeURIComponent(requestId)}`, {
      headers: auth(),
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);
    if (!res?.ok) continue;
    const json = (await res.json().catch(() => ({}))) as { status?: string; results?: JobResult[] };
    const mine = (json.results ?? []).find((r) => r.platform === platform);
    if (mine?.success === false) {
      throw new Error(`${platform} rejected the post: ${mine.error_message ?? "no reason given"}`);
    }
    if (mine?.success) {
      return {
        postId: mine.platform_post_id ?? requestId,
        postUrl: publicUrl(platform, mine.post_url, mine.platform_post_id),
      };
    }
    if (json.status === "completed") break;
  }
  return null;
}
