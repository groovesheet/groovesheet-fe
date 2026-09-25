#!/usr/bin/env node
/**
 * Tell Bing (and the engines sharing its index, including DuckDuckGo) that
 * URLs on this site changed, via the IndexNow protocol.
 *
 *   node scripts/indexnow.mjs            # the static pages sitemap
 *   node scripts/indexnow.mjs --all      # every child of the sitemap index
 *   node scripts/indexnow.mjs --dry-run  # print what would be sent
 *   node scripts/indexnow.mjs https://www.groovesheet.net/pricing  # exact URLs
 *
 * INDEXNOW_SITEMAP_ORIGIN reads the sitemap from somewhere else (a dev server,
 * a preview deploy) while still submitting only canonical URLs.
 *
 * Why this exists and Google's equivalent does not: Google's Indexing API is
 * limited to job postings and live-stream video, so for an ordinary page the
 * only levers are the sitemap and Search Console's "Request indexing", which
 * is manual, quota-limited, and explicitly not sped up by asking twice.
 * IndexNow is the one push notification a site like this may actually send.
 *
 * Ownership is proved by a key file served from the site root, which is why
 * the key is committed rather than kept in an environment variable: it is
 * public by design. Rotating it means adding the new public/<key>.txt and
 * changing KEY here.
 *
 * Run it after a deploy that changed page content. Submitting unchanged URLs
 * repeatedly is what the protocol asks you not to do.
 */

const KEY = '287ee47db1d13c91e0ec6d444653edf3';
const HOST = 'www.groovesheet.net';
const ORIGIN = `https://${HOST}`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
/**
 * Where to READ the sitemap from. The URLs inside it are absolute and
 * canonical whatever serves them, so pointing this at a dev server or a
 * preview deploy is how the script is verified before production has the new
 * sitemap. What gets submitted is still filtered to ORIGIN.
 */
const SITEMAP_ORIGIN = (process.env.INDEXNOW_SITEMAP_ORIGIN || ORIGIN).replace(/\/+$/, '');
// The protocol's own ceiling for one request.
const MAX_URLS = 10000;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const all = args.includes('--all');
const explicit = args.filter((a) => a.startsWith('http'));

const text = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': 'GrooveSheet-IndexNow/1.0' } });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  return res.text();
};

const locsIn = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

async function collectUrls() {
  if (explicit.length) return explicit;

  const index = await text(`${SITEMAP_ORIGIN}/sitemap.xml`);
  const children = locsIn(index);
  if (!children.length) throw new Error('sitemap index listed no children');

  // The pages child alone by default: the library child is ~300 track URLs
  // that change only when a track is republished, and blasting them on every
  // deploy is the behaviour the protocol asks you to avoid.
  const wanted = (all ? children : children.filter((c) => c.endsWith('/sitemaps/pages.xml'))).map((c) =>
    // A child is advertised at its canonical URL; read it from wherever the
    // sitemap itself was read.
    c.replace(ORIGIN, SITEMAP_ORIGIN)
  );

  const urls = new Set();
  for (const child of wanted) {
    try {
      for (const loc of locsIn(await text(child))) urls.add(loc);
    } catch (err) {
      // One unreachable child must not sink the submission of the others.
      console.warn(`skipping ${child}: ${err.message}`);
    }
  }
  return [...urls];
}

async function main() {
  const urls = (await collectUrls()).filter((u) => u.startsWith(ORIGIN)).slice(0, MAX_URLS);
  if (!urls.length) {
    console.error('No URLs to submit.');
    process.exit(1);
  }

  const body = { host: HOST, key: KEY, keyLocation: `${ORIGIN}/${KEY}.txt`, urlList: urls };

  if (dryRun) {
    console.log(`Would submit ${urls.length} URLs to ${ENDPOINT}`);
    for (const u of urls.slice(0, 20)) console.log(`  ${u}`);
    if (urls.length > 20) console.log(`  ... and ${urls.length - 20} more`);
    return;
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });

  // 200 accepted, 202 accepted but the key is still being verified. Both fine.
  if (res.status === 200 || res.status === 202) {
    console.log(`Submitted ${urls.length} URLs (HTTP ${res.status}).`);
    return;
  }
  console.error(`IndexNow rejected the submission: HTTP ${res.status} ${res.statusText}`);
  console.error(await res.text().catch(() => ''));
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
