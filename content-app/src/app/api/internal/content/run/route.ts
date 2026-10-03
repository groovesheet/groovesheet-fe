/* "Run now" from /internal/blog. Same run as the cron, behind the portal
   session (middleware gates /api/internal). A route rather than a server
   action because it needs its own region and a five minute ceiling. */
import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/content/generate";

export const runtime = "nodejs";
export const maxDuration = 300;
export const preferredRegion = "iad1";
export const dynamic = "force-dynamic";

export async function POST() {
  const result = await runPipeline("manual");
  return NextResponse.json(result, { status: result.outcome === "failed" ? 500 : 200 });
}
