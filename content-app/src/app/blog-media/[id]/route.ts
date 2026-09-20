/* Images uploaded through the post editor. Public, because the posts that
   reference them are. The id is a random UUID and the bytes never change, so
   the response is cached for good. */
import { getMedia } from "@/lib/content/store";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media = await getMedia(id.replace(/\.[a-z0-9]+$/i, "")).catch(() => null);
  if (!media) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(media.bytes), {
    headers: {
      "Content-Type": media.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
