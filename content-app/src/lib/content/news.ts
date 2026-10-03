/* Industry news tracking.

   There is no public API for "the most popular LinkedIn post in an industry":
   LinkedIn does not expose one and scraping it breaks their terms. What an
   industry is talking about is still measurable from the outside, through
   three kinds of open feed, all plain RSS or Atom with no key:

     search  Google News RSS for a query. Wide, fresh, and ranked by Google's
             own notion of prominence, which is the closest free proxy for
             "big" there is.
     trade   The music tech and music business trade press. Narrow and on topic.
     reddit  The week's top posts in the practitioner subreddits. This is the
             popularity signal: it is what people in the field upvoted.

   The feed list lives in scripts/pipeline.config.json under `news`, next to
   every other business-specific value. */
import cfg from "../../../scripts/pipeline.config.json";
import type { NewsInput } from "./store";

type FeedKind = "search" | "trade" | "reddit";
type Feed = { kind: FeedKind; name: string; url: string };

const UA = "Mozilla/5.0 (compatible; GrooveSheetNewsBot/1.0; +https://www.groovesheet.net)";

export function feeds(): Feed[] {
  const n = cfg.news;
  const search = n.searchQueries.map((q: string) => ({
    kind: "search" as const,
    name: `Google News: ${q}`,
    url:
      "https://news.google.com/rss/search?q=" +
      encodeURIComponent(`${q} when:${n.maxAgeDays}d`) +
      "&hl=en-US&gl=US&ceid=US:en",
  }));
  const trade = n.tradeFeeds.map((f: { name: string; url: string }) => ({
    kind: "trade" as const,
    ...f,
  }));
  const reddit = n.subreddits.map((s: string) => ({
    kind: "reddit" as const,
    name: `r/${s}`,
    url: `https://www.reddit.com/r/${s}/top/.rss?t=week`,
  }));
  return [...search, ...trade, ...reddit];
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

function text(s: string): string {
  return decode(decode(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
}

/** RSS <item> and Atom <entry>, which is what Reddit serves. */
export function parseFeed(xml: string, feed: Feed): NewsInput[] {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  const out: NewsInput[] = [];
  for (const b of blocks) {
    const title = text(tag(b, "title"));
    let url = text(tag(b, "link"));
    if (!url) url = decode(b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "");
    if (!title || !/^https?:\/\//.test(url)) continue;

    const dateRaw = text(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated"));
    const date = dateRaw ? new Date(dateRaw) : null;
    const summary = text(tag(b, "description") || tag(b, "summary") || tag(b, "content")).slice(
      0,
      600,
    );
    // Google News carries the publisher in <source>; elsewhere the feed is the source.
    const source = text(tag(b, "source")) || feed.name;

    out.push({
      url,
      title: title.slice(0, 300),
      source,
      feed: feed.name,
      summary,
      publishedAt: date && !isNaN(date.getTime()) ? date.toISOString() : null,
    });
  }
  return out;
}

async function fetchFeed(feed: Feed): Promise<NewsInput[]> {
  const res = await fetch(feed.url, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, text/xml, */*" },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status} from ${feed.name}`);
  return parseFeed(await res.text(), feed);
}

export type Scan = { items: NewsInput[]; feedErrors: string[] };

/** Every feed in parallel. One dead feed never sinks the scan. */
export async function scanNews(): Promise<Scan> {
  const all = feeds();
  /* Reddit answers 429 to parallel requests from one address, so its feeds go
     one at a time, alongside everything else going at once. It also refuses
     some datacentre ranges outright. Either way it is one signal of three and
     the scan carries on without it. */
  const redditChain = (async () => {
    const out: PromiseSettledResult<NewsInput[]>[] = [];
    for (const f of all.filter((x) => x.kind === "reddit")) {
      out.push(await fetchFeed(f).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason) => ({ status: "rejected" as const, reason }),
      ));
      await new Promise((r) => setTimeout(r, 1500));
    }
    return out;
  })();
  const others = await Promise.allSettled(all.filter((x) => x.kind !== "reddit").map(fetchFeed));
  const reddit = await redditChain;
  let oi = 0;
  let ri = 0;
  const settled = all.map((f) => (f.kind === "reddit" ? reddit[ri++] : others[oi++]));
  const feedErrors: string[] = [];
  const cutoff = Date.now() - cfg.news.maxAgeDays * 86400_000;
  const seen = new Set<string>();
  const items: NewsInput[] = [];

  settled.forEach((r, i) => {
    if (r.status === "rejected") {
      feedErrors.push(`${all[i].name}: ${r.reason instanceof Error ? r.reason.message : r.reason}`);
      return;
    }
    let kept = 0;
    for (const item of r.value) {
      if (kept >= cfg.news.maxPerFeed) break;
      if (item.publishedAt && new Date(item.publishedAt).getTime() < cutoff) continue;
      // The same wire story arrives from several queries under one headline.
      const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);
      if (seen.has(key) || seen.has(item.url)) continue;
      seen.add(key);
      seen.add(item.url);
      items.push(item);
      kept++;
    }
  });

  return { items, feedErrors };
}
