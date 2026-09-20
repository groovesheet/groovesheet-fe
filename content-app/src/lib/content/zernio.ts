/* Zernio: LinkedIn and Facebook posting. https://docs.zernio.com

   Same request shape as scripts/syndicate.mjs, which is the CLI for the same
   job. This is GrooveSheet's own Zernio workspace, keyed by ZERNIO_API_KEY. */
import type { SocialPlatform } from "./types";

const BASE = "https://zernio.com/api/v1";

const ACCOUNT_ENV: Partial<Record<SocialPlatform, string>> = {
  linkedin: "ZERNIO_LINKEDIN_ACCOUNT_ID",
  facebook: "ZERNIO_FACEBOOK_ACCOUNT_ID",
};

export function zernioConfigured(): boolean {
  return Boolean(process.env.ZERNIO_API_KEY);
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

type Account = { _id?: string; id?: string; platform?: string; isActive?: boolean };

async function accountId(platform: SocialPlatform): Promise<string> {
  const fromEnv = process.env[ACCOUNT_ENV[platform] ?? ""];
  if (fromEnv) return fromEnv;
  const res = await fetch(`${BASE}/accounts?platform=${platform}`, {
    headers: headers(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Zernio accounts lookup failed: ${res.status}`);
  const json = (await res.json()) as { accounts?: Account[] };
  const hit = (json.accounts ?? []).find((a) => a.platform === platform && a.isActive !== false);
  const id = hit?._id ?? hit?.id;
  if (!id) throw new Error(`No ${platform} account is connected in Zernio`);
  return id;
}

export type Posted = { zernioPostId: string | null; platformUrl: string | null };

/** Publishes now. `requestId` is Zernio's idempotency key: a retry with the
    same id returns the original post instead of posting twice. */
export async function publishNow(
  platform: SocialPlatform,
  content: string,
  requestId: string,
  /** Public HTTPS address of the cover. Attached so the post carries the
      picture itself and does not rely on the platform building a link preview. */
  imageUrl?: string,
): Promise<Posted> {
  if (!zernioConfigured()) throw new Error("ZERNIO_API_KEY is not set");

  const target: Record<string, unknown> = { platform, accountId: await accountId(platform) };
  const specific: Record<string, string> = {};
  if (platform === "facebook" && process.env.ZERNIO_FACEBOOK_PAGE_ID) {
    specific.pageId = process.env.ZERNIO_FACEBOOK_PAGE_ID;
  }
  if (platform === "linkedin" && process.env.ZERNIO_LINKEDIN_ORGANIZATION_URN) {
    specific.organizationUrn = process.env.ZERNIO_LINKEDIN_ORGANIZATION_URN;
  }
  if (Object.keys(specific).length) target.platformSpecificData = specific;

  const res = await fetch(`${BASE}/posts`, {
    method: "POST",
    headers: headers({ "x-request-id": requestId }),
    body: JSON.stringify({
      content,
      platforms: [target],
      publishNow: true,
      ...(imageUrl ? { mediaItems: [{ type: "image", url: imageUrl }] } : {}),
    }),
    signal: AbortSignal.timeout(60000),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Zernio ${res.status}: ${raw.slice(0, 400)}`);

  type Entry = { platform?: string; status?: string; platformPostUrl?: string; errorMessage?: string };
  const json = JSON.parse(raw) as { post?: { _id?: string; platforms?: Entry[] }; _id?: string; platforms?: Entry[] };
  const entry = (json.post?.platforms ?? json.platforms ?? []).find((p) => p.platform === platform);
  if (entry?.status === "failed") {
    throw new Error(`${platform} rejected the post: ${entry.errorMessage ?? JSON.stringify(entry).slice(0, 300)}`);
  }
  return {
    zernioPostId: json.post?._id ?? json._id ?? null,
    platformUrl: entry?.platformPostUrl ?? null,
  };
}

/** Takes a live post off the network. Zernio will not re-run the record, so a
    repost is a fresh publishNow. */
export async function takeDown(zernioPostId: string, platform: SocialPlatform): Promise<void> {
  if (!zernioConfigured()) throw new Error("ZERNIO_API_KEY is not set");
  const res = await fetch(`${BASE}/posts/${encodeURIComponent(zernioPostId)}/unpublish`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ platform }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Zernio ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
