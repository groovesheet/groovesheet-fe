/* The scheduled run. Vercel Cron calls this every three days (vercel.json)
   with `Authorization: Bearer $CRON_SECRET`.

   It sits outside /api/internal on purpose: that prefix is gated by the portal
   session cookie in middleware, and a cron has no cookie. The bearer check
   below is the whole gate, so it fails closed when CRON_SECRET is unset.

   A run drafts and stops. It cannot publish: see src/lib/content/publish.ts. */
import { NextResponse, type NextRequest } from "next/server";
import { runPipeline } from "@/lib/content/generate";

export const runtime = "nodejs";
export const maxDuration = 300;
// LLM providers geo-block sin1, this project's home region. See src/lib/content/llm.ts.
export const preferredRegion = "iad1";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.CONTENT_PIPELINE_PAUSED === "1") {
    return NextResponse.json({ outcome: "paused" });
  }
  const result = await runPipeline("cron");
  return NextResponse.json(result, { status: result.outcome === "failed" ? 500 : 200 });
}
