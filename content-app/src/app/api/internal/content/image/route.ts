/* Image intake for the post editor: a file (toolbar, drop, paste) or the URL
   of an image hosted elsewhere, which is fetched and re-hosted so a post never
   depends on someone else's server. Behind the portal session (middleware).

   SVG is refused: it is a script container, and these are served from our own
   origin. */
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/app/internal/_lib/auth";
import { insertMedia } from "@/lib/content/store";

export const runtime = "nodejs";

// A Vercel function body tops out at 4.5 MB.
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/** Refuse anything that is not plainly a public web address. */
function safeRemote(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return null;
    if (/^(\d+\.){3}\d+$/.test(h) || h.includes(":")) return null; // no raw IPs
    return u;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return fail("Not signed in", 401);

  let bytes: Buffer;
  let mime: string;
  let alt = "";

  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    const { url } = (await req.json().catch(() => ({}))) as { url?: string };
    const remote = safeRemote(url ?? "");
    if (!remote) return fail("That is not an image address we can fetch.");
    const res = await fetch(remote, { signal: AbortSignal.timeout(15000), redirect: "follow" }).catch(() => null);
    if (!res?.ok) return fail("Could not fetch that image.");
    mime = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    bytes = Buffer.from(await res.arrayBuffer());
  } else {
    const form = await req.formData().catch(() => null);
    const file = form?.get("image");
    if (!(file instanceof File)) return fail("No image in the upload.");
    mime = file.type.toLowerCase();
    alt = file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").slice(0, 200);
    bytes = Buffer.from(await file.arrayBuffer());
  }

  if (!ALLOWED.has(mime)) return fail("Use a PNG, JPEG, WebP, GIF or AVIF image.");
  if (bytes.length === 0) return fail("The image is empty.");
  if (bytes.length > MAX_BYTES) return fail("Image exceeds 4 MB. Resize or compress it first.");

  const id = await insertMedia({ mime, bytes, alt, by: session.user });
  return NextResponse.json({ url: `/blog-media/${id}.${EXT[mime]}` });
}
