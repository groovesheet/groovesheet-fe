#!/usr/bin/env node
/**
 * Bakes the marketing routes into real static HTML after `react-scripts build`.
 *
 * Why this exists
 * ---------------
 * www.groovesheet.net is a CRA single-page app. The file it actually serves is
 * a 5 KB shell: one <title>, one description, and no body copy. React fills the
 * page in the browser, which is fine for people and useless for most crawlers.
 * Google will render JavaScript, but on its own schedule and budget; Bing and
 * the AI crawlers largely will not. Measured 2026-09-20: 280 URLs in the
 * sitemap, one distinct <title> among them, four indexed keywords.
 *
 * This script loads each marketing route in headless Chromium, lets React run,
 * then writes the resulting DOM to build/<route>/index.html. Vercel serves that
 * file directly, so a crawler's first byte already contains the real title,
 * description, canonical and body copy. The React bundle still boots on top and
 * takes over, so behaviour for humans is unchanged.
 *
 * Failure policy
 * --------------
 * A prerender failure must never fail a deploy. Everything below is wrapped so
 * that any error logs loudly and exits 0, leaving the normal SPA build in
 * place. A site that renders client-side is a bad day; a site that will not
 * deploy is a worse one.
 *
 * Run standalone with `npm run prerender` after a build, or let `npm run build`
 * chain it.
 */

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD_DIR = join(ROOT, 'build');
const ROUTES = JSON.parse(
  readFileSync(join(ROOT, 'src/seo/prerenderRoutes.json'), 'utf8'),
);

/* "/" is deliberately NOT in that list.
 *
 * build/index.html is two things at once: the home page, and the SPA fallback
 * Vercel serves for every path with no file behind it. Prerendering the home
 * page into it would hand all ~265 /explore/* track pages a document whose
 * canonical says https://www.groovesheet.net/ — telling Google every one of
 * them is a duplicate of the home page. That is worse than the shell they get
 * today, which asserts nothing.
 *
 * Prerendering the home page needs the fallback moved to its own file and a
 * catch-all rewrite added to vercel.json, which changes routing for every
 * dynamic URL on the site and wants a preview deploy to verify. Until then the
 * home page keeps the real title, description and JSON-LD already baked into
 * public/index.html, which are correct for it.
 */

/* How long to let a route settle before snapshotting. The pages are static
   marketing copy, so this is about fonts and the i18n bundle resolving, not
   data fetching. */
const SETTLE_MS = 1200;
const NAV_TIMEOUT_MS = 30000;

/* The public origin these files will be served from.
   usePageMeta builds the canonical and og:url from window.location, which
   during a prerender is the throwaway localhost server below. Freezing that
   into the HTML would ship canonicals pointing at 127.0.0.1 and tell Google
   the real pages do not exist, so every occurrence is rewritten on the way
   out. Must match the host in public/index.html and the backend's
   services.social_canonical. */
const CANONICAL_ORIGIN = process.env.PRERENDER_ORIGIN || 'https://www.groovesheet.net';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

/**
 * Minimal static server with SPA fallback: anything without a file extension
 * that does not exist on disk gets index.html, which is what Vercel does for
 * this project in production.
 */
function serveBuild(shell) {
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const filePath = join(BUILD_DIR, path);

      if (!filePath.startsWith(BUILD_DIR)) {
        res.writeHead(403).end();
        return;
      }

      // Route requests are answered from the in-memory shell rather than from
      // disk. This run writes index.html files into the very directories it is
      // still crawling, so reading them back would prerender a prerender:
      // the second pass would inherit the first pass's absolute URLs and
      // frozen DOM. Serving the pristine shell keeps every route independent
      // and the whole script idempotent.
      if (!extname(filePath) || !existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(shell);
        return;
      }

      const body = await readFile(filePath);
      res.writeHead(200, {
        'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
      });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });

  return new Promise((resolve) => {
    // Port 0 lets the OS pick a free one, so concurrent builds cannot collide.
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/**
 * Chromium, from whichever source this machine has.
 *
 * On Vercel the build container has no system Chrome and no shared libraries
 * for a vanilla puppeteer download, so @sparticuz/chromium supplies a binary
 * built for that environment. Locally, PUPPETEER_EXECUTABLE_PATH or an
 * installed Chrome is faster to start.
 */
async function launchBrowser() {
  const puppeteer = (await import('puppeteer-core')).default;

  const explicit = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (explicit) {
    return puppeteer.launch({
      executablePath: explicit,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
  }

  const chromium = (await import('@sparticuz/chromium')).default;
  return puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: chromium.args,
    defaultViewport: { width: 1280, height: 900 },
    headless: true,
  });
}

/**
 * Strip the things that must not be frozen into a static file.
 *
 * The snapshot is taken from a live page, so it carries whatever the analytics
 * and auth scripts happened to write into the DOM at that moment. Those belong
 * to one session, not to every visitor who later downloads this file.
 */
function cleanupScript() {
  // Runs inside the page.
  /* eslint-env browser */

  // Clerk paints auth UI for whoever rendered the page. The bundle rebuilds it
  // on boot, so a frozen copy is at best stale and at worst one session's state
  // served to everyone.
  document
    .querySelectorAll('[data-clerk-component], .cl-modalBackdrop, #clerk-components')
    .forEach((el) => el.remove());

  /* The analytics and ad tags fire while Chromium renders, and what they write
     back into the DOM is a beacon for THIS pageview: iframes and pixels whose
     URLs embed the render-time page address, the viewport, and a cache buster.
     Freezing those would ship a build-machine beacon to every visitor and, as
     the URLs are percent-encoded, smuggle the local origin past a plain string
     rewrite. The inline bootstrap snippets in index.html are untouched and
     re-initialise all of this properly in the browser, so the injected output
     is pure residue. */
  const TRACKER_HOSTS = [
    'connect.facebook.net',
    'facebook.com/tr',
    'googletagmanager.com',
    'google-analytics.com',
    'googlesyndication.com',
    'googleadservices.com',
    'doubleclick.net',
    'google.com/ads',
  ];

  document.querySelectorAll('script[src], img[src], iframe[src], link[href]').forEach((el) => {
    const url = el.getAttribute('src') || el.getAttribute('href') || '';
    if (TRACKER_HOSTS.some((h) => url.includes(h))) el.remove();
  });

  /* Beacons that carry the render-time address but no recognisable tracker
     host. Restricted to img and iframe: a <link> pointing at the local origin
     is the canonical this whole exercise exists to publish, and it gets
     rewritten to the public origin on the way out rather than deleted. */
  document.querySelectorAll('img[src], iframe[src]').forEach((el) => {
    const url = el.getAttribute('src') || '';
    if (url.includes('127.0.0.1') || url.includes('localhost:')) el.remove();
  });

  // AdSense rewrites its own placeholders as it fills them; reset them so the
  // slots are re-requested client-side instead of shipping a filled shell.
  document.querySelectorAll('ins.adsbygoogle').forEach((el) => {
    el.removeAttribute('data-adsbygoogle-status');
    el.removeAttribute('data-ad-status');
    el.innerHTML = '';
  });

  // Mark the file so it is obvious in production where it came from, and so a
  // second prerender pass can detect and refuse its own output.
  document.documentElement.setAttribute('data-prerendered', 'true');

  return document.documentElement.outerHTML;
}

async function prerender() {
  const shellPath = join(BUILD_DIR, 'index.html');
  if (!existsSync(shellPath)) {
    console.warn('[prerender] no build/index.html — run `npm run build:spa` first. Skipping.');
    return;
  }

  const shell = await readFile(shellPath, 'utf8');
  if (shell.includes('data-prerendered')) {
    // build/ already holds output from a previous run. react-scripts build
    // clears the directory, so this only happens when prerender is run twice
    // by hand — and rendering these again would compound the first result.
    console.warn('[prerender] build/ is already prerendered — run `npm run build:spa` first. Skipping.');
    return;
  }

  const { server, port } = await serveBuild(shell);
  const origin = `http://127.0.0.1:${port}`;
  let browser;
  const failed = [];
  let written = 0;

  try {
    browser = await launchBrowser();

    for (const route of ROUTES) {
      const page = await browser.newPage();
      try {
        // Crawlers are the audience for this output, so render as one. It also
        // keeps any consent or locale gate that keys off a real browser UA from
        // firing during the snapshot.
        await page.setUserAgent(
          'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        );
        await page.goto(`${origin}${route}`, {
          waitUntil: 'networkidle0',
          timeout: NAV_TIMEOUT_MS,
        });
        await new Promise((r) => setTimeout(r, SETTLE_MS));

        const rendered = await page.evaluate(cleanupScript);
        // Rewrite both the plain and percent-encoded forms. Third-party tags
        // embed the page address inside query strings, where it arrives
        // encoded and a plain replace would walk straight past it.
        const html = rendered
          .split(origin)
          .join(CANONICAL_ORIGIN)
          .split(encodeURIComponent(origin))
          .join(encodeURIComponent(CANONICAL_ORIGIN));

        // A snapshot with no <title> beyond the shell default means React never
        // mounted. Writing that would replace a working SPA route with a broken
        // static file, so treat it as a failure and leave the route alone.
        if (!/<title>[^<]+<\/title>/.test(html) || html.length < 2000) {
          throw new Error('render produced no usable HTML');
        }
        // Belt and braces: a localhost URL reaching production would be worse
        // than no prerender at all, so refuse to write one.
        if (html.includes('127.0.0.1') || html.includes('localhost:')) {
          throw new Error('local origin survived the rewrite');
        }

        const outDir = route === '/' ? BUILD_DIR : join(BUILD_DIR, route);
        await mkdir(outDir, { recursive: true });
        await writeFile(join(outDir, 'index.html'), `<!doctype html>\n${html}`, 'utf8');

        const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
        console.log(`[prerender] ${route.padEnd(24)} ${(html.length / 1024).toFixed(0)}KB  ${title}`);
        written += 1;
      } catch (err) {
        failed.push(`${route}: ${err.message}`);
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await browser?.close().catch(() => {});
    server.close();
  }

  console.log(`[prerender] wrote ${written}/${ROUTES.length} routes`);
  if (failed.length) {
    console.warn(`[prerender] skipped ${failed.length}:\n  ${failed.join('\n  ')}`);
  }
}

try {
  await prerender();
} catch (err) {
  // Never fail the deploy over this. The SPA build in build/ is still valid.
  console.warn(`[prerender] skipped entirely: ${err.message}`);
}
process.exit(0);
