#!/usr/bin/env node
/* Builds content/seo-keywords.json: the measured keywords the content pipeline
   may target, with their Singapore monthly search volumes.

   Two sources, both already measured and both already in the repo:
     marketing/keyword-planner-*.csv   Google Ads Keyword Planner exports
                                       (produced by scripts/keyword-planner.mjs)
     content/keyword-queue.yaml        SE Ranking figures for the guide queue

   The drafting prompt and the portal editor read the JSON, not these files,
   because neither can call Google Ads at run time: that API needs an OAuth
   refresh token that lives in ~/.config/groovesheet/, not on Vercel. To refresh
   the list, run keyword-planner.mjs, then this.

     node scripts/build-seo-keywords.mjs
*/
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const MARKETING = join(ROOT, "..", "marketing");
const byKeyword = new Map();

function add(keyword, volume, source, measuredAt) {
  const k = keyword.trim().toLowerCase();
  if (!k || !Number.isFinite(volume) || volume <= 0) return;
  const prev = byKeyword.get(k);
  if (!prev || measuredAt > prev.measuredAt) byKeyword.set(k, { keyword: k, volume, source, measuredAt });
}

for (const file of readdirSync(MARKETING).filter((f) => /^keyword-planner-.*\.csv$/.test(f))) {
  const measuredAt = file.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
  const [, ...rows] = readFileSync(join(MARKETING, file), "utf8").trim().split(/\r?\n/);
  for (const row of rows) {
    const m = row.match(/^"?([^",]+)"?,(\d+)/);
    if (m) add(m[1], Number(m[2]), "Google Ads Keyword Planner", measuredAt);
  }
}

const queue = readFileSync(join(ROOT, "content", "keyword-queue.yaml"), "utf8");
const queueDate = queue.match(/on (\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
for (const m of queue.matchAll(/- keyword:\s*"([^"]+)"\s*\n\s*volume:\s*(\d+)/g)) {
  add(m[1], Number(m[2]), "SE Ranking", queueDate);
}

const keywords = [...byKeyword.values()].sort((a, b) => b.volume - a.volume);
writeFileSync(
  join(ROOT, "content", "seo-keywords.json"),
  JSON.stringify({ market: "Singapore", builtAt: new Date().toISOString().slice(0, 10), keywords }, null, 2) + "\n",
);
console.log(`Wrote ${keywords.length} measured keywords to content/seo-keywords.json`);
