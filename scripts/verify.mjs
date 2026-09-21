#!/usr/bin/env node
/**
 * P8 verification harness: the brief's section 7 "definition of done", as
 * checks a script can make. Brief: MIGRATE-FE-TO-NEXTJS.md.
 *
 * Run it against a PRODUCTION server. The cache-leak check (brief 5.9) means
 * nothing under `next dev`, which re-renders every request, so the harness
 * refuses a dev server.
 *
 *   npm run build
 *   npx next start -p 3210 &
 *   node scripts/verify.mjs
 *
 * Options:
 *   --skip-toolchain   do not run tsc, eslint and vitest
 *   --static-only      repo checks and toolchain only, no HTTP
 *   --http-only        HTTP checks only
 *   --json             also print the results as JSON on the last line
 *
 * Environment:
 *   BASE_URL            server under test (default http://localhost:3210)
 *   API_ORIGIN          where real song ids come from (default https://api.groovesheet.net)
 *   VERIFY_SONG_IDS     comma-separated library track ids, instead of asking the API
 *   VERIFY_USERNAME     a real creator username for /u/:username. The public
 *                       library does not expose owners today, so without this
 *                       the creator route cannot be discovered and is SKIP
 *   VERIFY_AUTH_COOKIE  a real signed-in Cookie header (copy it from devtools)
 *                       for the cache-leak check. Without it a forged
 *                       sb-<ref>-auth-token cookie is sent, which proves the
 *                       page ignores cookies but not that a valid session is
 *                       ignored too
 *   VERIFY_CUTOVER=1    after Wave 2: prerender.mjs deleted and the vercel.json
 *                       UA rewrites gone become failures instead of PENDING
 *   VERIFY_ALLOW_SKIP=1 a SKIP (missing test data) does not fail the run
 *
 * Exit status is 1 when any check FAILs (or SKIPs, unless allowed).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const BASE_URL = (process.env.BASE_URL || 'http://localhost:3210').replace(/\/+$/, '');
const API_ORIGIN = (process.env.API_ORIGIN || 'https://api.groovesheet.net').replace(/\/+$/, '');
const CUTOVER = process.env.VERIFY_CUTOVER === '1';
const ALLOW_SKIP = process.env.VERIFY_ALLOW_SKIP === '1';

// api.groovesheet.net is behind Cloudflare, which challenges a bare Node UA.
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/140.0.0.0 Safari/537.36';
const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const TIER_A = ['/', '/pricing', '/stem-splitter', '/midi-converter', '/developers', '/about', '/changelog', '/help'];
// Not in the brief's Tier A list, but public, in routeMeta, and owned by P3,
// so they are held to the same distinct-title rule.
const LEGAL = ['/terms', '/privacy-policy', '/refund-policy', '/business-information'];
const LOCALE_SAMPLES = ['/about', '/pricing', '/explore'];
const SONG_COUNT = 3;

// ---------------------------------------------------------------------------
// Results

/** @type {{ group: string, name: string, target: string, status: 'PASS'|'FAIL'|'WARN'|'SKIP'|'PENDING', detail: string }[]} */
const results = [];

function record(group, name, target, status, detail = '') {
  results.push({ group, name, target, status, detail });
}

const pass = (group, name, target, detail) => record(group, name, target, 'PASS', detail);
const fail = (group, name, target, detail) => record(group, name, target, 'FAIL', detail);

function check(group, name, target, ok, failDetail, passDetail = '') {
  if (ok) pass(group, name, target, passDetail);
  else fail(group, name, target, failDetail);
}

// ---------------------------------------------------------------------------
// HTML helpers. Regex, not a DOM: this reads raw server HTML exactly as a
// crawler with JavaScript disabled would, and needs no dependency.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (whole, code) => {
    const lower = code.toLowerCase();
    if (lower.startsWith('#x')) return String.fromCodePoint(parseInt(lower.slice(2), 16));
    if (lower.startsWith('#')) return String.fromCodePoint(parseInt(lower.slice(1), 10));
    return ENTITIES[lower] ?? whole;
  });
}

const stripTags = (html) => decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

/** The document <title>, from <head> only (an inline SVG <title> is not it). */
function extractTitle(html) {
  const head = html.split(/<\/head>/i)[0];
  const match = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripTags(match[1]) : '';
}

/** Every non-empty <h1> text in the raw HTML. */
function extractH1s(html) {
  return [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => stripTags(m[1])).filter(Boolean);
}

function extractHtmlLang(html) {
  const match = html.match(/<html\b[^>]*\blang=["']([^"']+)["']/i);
  return match ? match[1] : '';
}

/** Visible text plus the RSC payload, entity-decoded, for "does the body mention X". */
function searchableBody(html) {
  return decodeEntities(html).replace(/\\u0026/g, '&').replace(/\\"/g, '"');
}

/**
 * Remove what legitimately differs between two renders of the same page for
 * different requests: CSP nonces and deployment ids. Anything else that
 * differs is content, which is exactly what the leak check looks for.
 */
function normalizeForDiff(html) {
  return html
    .replace(/\snonce="[^"]*"/g, ' nonce=""')
    .replace(/"buildId":"[^"]*"/g, '"buildId":""')
    .replace(/([?&])dpl=[^"&\s]+/g, '$1dpl=')
    .replace(/\sdata-dpl-id="[^"]*"/g, '');
}

function firstDifference(a, b) {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && a[i] === b[i]) i += 1;
  if (i === limit && a.length === b.length) return null;
  const context = (s) => JSON.stringify(s.slice(Math.max(0, i - 60), i + 100));
  return `first difference at byte ${i}: anonymous ${context(a)} vs cookie ${context(b)}`;
}

// ---------------------------------------------------------------------------
// HTTP

async function get(url, { ua = BROWSER_UA, cookie } = {}) {
  const headers = { 'User-Agent': ua, Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8' };
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(60_000) });
  const body = await response.text();
  return { status: response.status, headers: response.headers, body };
}

/** A page of the server under test, with the failure turned into a result instead of a crash. */
async function page(pathname, options) {
  try {
    return await get(`${BASE_URL}${pathname}`, options);
  } catch (error) {
    return { status: 0, headers: new Headers(), body: '', error: String(error?.message || error) };
  }
}

function setCookieHeaders(headers) {
  return typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [headers.get('set-cookie')].filter(Boolean);
}

// ---------------------------------------------------------------------------
// Test data: real ids from the public library. One request, well inside the
// 60/min limit on /library/tracks.

async function discoverSongs() {
  const fromEnv = (process.env.VERIFY_SONG_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (fromEnv.length) {
    const songs = [];
    for (const id of fromEnv) {
      const { status, body } = await get(`${API_ORIGIN}/library/tracks/${encodeURIComponent(id)}`);
      if (status !== 200) throw new Error(`${API_ORIGIN}/library/tracks/${id} returned ${status}`);
      songs.push(JSON.parse(body));
    }
    return { songs, owners: [] };
  }
  const { status, body } = await get(`${API_ORIGIN}/library/tracks?limit=20&page=1`);
  if (status !== 200) throw new Error(`${API_ORIGIN}/library/tracks returned ${status}: ${body.slice(0, 200)}`);
  const tracks = JSON.parse(body).tracks || [];
  const owners = [...new Set(tracks.map((t) => t.owner?.username).filter(Boolean))];
  // Prefer titles long enough to be unambiguous in a body search.
  const songs = tracks.filter((t) => t.id && typeof t.title === 'string' && t.title.trim().length >= 3).slice(0, SONG_COUNT);
  return { songs, owners };
}

/** The Supabase project ref, so the forged cookie has the name proxy.ts looks for. */
function supabaseCookieName() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!url) {
    for (const file of ['.env.local', '.env.production', '.env']) {
      const full = path.join(ROOT, file);
      if (!fs.existsSync(full)) continue;
      const match = fs.readFileSync(full, 'utf8').match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m);
      if (match) {
        url = match[1].trim().replace(/^["']|["']$/g, '');
        break;
      }
    }
  }
  const ref = url.match(/^https?:\/\/([^.]+)\./)?.[1] || 'verify';
  return `sb-${ref}-auth-token`;
}

/** A syntactically valid, cryptographically worthless @supabase/ssr session cookie. */
function forgedAuthCookie() {
  const b64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const jwt = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({
    sub: '00000000-0000-4000-8000-000000000000',
    email: 'verify@example.com',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.forged-signature`;
  const session = {
    access_token: jwt,
    refresh_token: 'forged-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000000', email: 'verify@example.com' },
  };
  return `${supabaseCookieName()}=base64-${b64url(session)}`;
}

// ---------------------------------------------------------------------------
// Static checks (no server)

function listSourceFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'src', 'vendor', 'content-app', 'design-system', 'public', 'supabase', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listSourceFiles(full, acc);
    else if (/\.(m?[jt]sx?)$/.test(entry.name) && !/\.test\.[jt]sx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) acc.push(full);
  }
  return acc;
}

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Brief 5.3: no server code calls getSession(). A call is allowed only in a
 * module whose first statement is 'use client' and that pulls in nothing
 * server-only; everything else (route handlers, proxy.ts, Server Components,
 * shared lib modules a Server Component could import) is server code.
 */
function checkGetSession() {
  const offenders = [];
  for (const file of listSourceFiles(ROOT)) {
    const rel = path.relative(ROOT, file);
    if (rel.startsWith('scripts/') || rel.startsWith('tests/')) continue;
    const text = fs.readFileSync(file, 'utf8');
    const code = stripComments(text);
    if (!/\bgetSession\s*\(/.test(code)) continue;
    const isClient = /^\s*(['"])use client\1/.test(code);
    const pullsServer = /from\s+['"](server-only|next\/headers)['"]|import\s+['"]server-only['"]/.test(code);
    const isServerEntry = /(^|\/)(route|proxy|middleware)\.[jt]sx?$/.test(rel);
    if (!isClient || pullsServer || isServerEntry) {
      const lines = code.split('\n').map((line, i) => (/\bgetSession\s*\(/.test(line) ? i + 1 : 0)).filter(Boolean);
      offenders.push(`${rel}:${lines.join(',')}`);
    }
  }
  check('static', 'no server-side getSession()', 'app/ lib/ components/ proxy.ts', offenders.length === 0,
    `server code calls getSession(): ${offenders.join('; ')}`, 'only client modules call it');
}

function checkPrerenderNotInBuild() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const scripts = pkg.scripts || {};
  // npm runs pre<name> and post<name> around a script, and a script can call
  // another, so any script mentioning prerender is suspect, not just build.
  const offenders = Object.entries(scripts).filter(([, command]) => /prerender/.test(String(command)));
  check('static', 'prerender.mjs not in npm run build', 'package.json scripts', offenders.length === 0,
    `scripts reference prerender: ${offenders.map(([name, cmd]) => `${name}="${cmd}"`).join('; ')}`,
    `build="${scripts.build || ''}"`);

  const exists = fs.existsSync(path.join(ROOT, 'scripts', 'prerender.mjs'));
  if (!exists) pass('cutover', 'scripts/prerender.mjs deleted', 'scripts/', '');
  else record('cutover', 'scripts/prerender.mjs deleted', 'scripts/', CUTOVER ? 'FAIL' : 'PENDING', 'still present; Wave 2 deletes it');
}

function checkVercelUaRewrites() {
  const file = path.join(ROOT, 'vercel.json');
  const config = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const uaRules = (config.rewrites || []).filter((rule) =>
    (rule.has || []).some((condition) => condition.type === 'header' && String(condition.key).toLowerCase() === 'user-agent'));
  if (uaRules.length === 0) pass('cutover', 'vercel.json UA rewrites removed', 'vercel.json', '');
  else record('cutover', 'vercel.json UA rewrites removed', 'vercel.json', CUTOVER ? 'FAIL' : 'PENDING',
    `still rewriting by user agent: ${uaRules.map((rule) => rule.source).join(', ')}; Wave 2 deletes them`);
}

function runTool(name, command, commandArgs) {
  const started = Date.now();
  const run = spawnSync(command, commandArgs, { cwd: ROOT, encoding: 'utf8', timeout: 15 * 60_000, env: { ...process.env, CI: '1', FORCE_COLOR: '0' } });
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  const output = `${run.stdout || ''}${run.stderr || ''}`.trim();
  const tail = output.split('\n').slice(-12).join('\n');
  check('toolchain', name, `${command} ${commandArgs.join(' ')}`, run.status === 0,
    `exit ${run.status ?? run.signal} after ${seconds}s\n${tail}`, `${seconds}s`);
}

// ---------------------------------------------------------------------------
// HTTP checks

async function checkServerIsProduction() {
  const response = await page('/about');
  if (response.error) {
    fail('preflight', 'server reachable', BASE_URL, `${response.error}. Start it: npm run build && npx next start -p 3210`);
    return false;
  }
  pass('preflight', 'server reachable', BASE_URL, `GET /about -> ${response.status}`);
  const isDev = /hmr-client|react-refresh|__nextDevClientId|next-devtools/i.test(response.body);
  check('preflight', 'production server, not next dev', BASE_URL, !isDev,
    'looks like `next dev`: dev re-renders every request, so the cache checks are meaningless. Use `next start`');
  return !isDev;
}

/**
 * The core section 7 check for one public route: 200, a <title>, an <h1> with
 * JavaScript disabled, no Set-Cookie for an anonymous visitor, and (unless the
 * route is inherently per-request) cacheable rather than dynamic.
 */
async function checkPublicRoute(group, pathname, { cacheable = true } = {}) {
  const response = await page(pathname);
  const result = { pathname, title: '', ok: false };
  if (response.status !== 200) {
    fail(group, 'status 200', pathname, response.error || `status ${response.status}${response.headers.get('location') ? ` -> ${response.headers.get('location')}` : ''}`);
    return result;
  }
  pass(group, 'status 200', pathname, '');

  result.title = extractTitle(response.body);
  check(group, '<title> present', pathname, result.title.length > 0, 'no <title> in raw HTML', result.title);

  const h1s = extractH1s(response.body);
  check(group, '<h1> without JS', pathname, h1s.length > 0,
    'no non-empty <h1> in raw HTML (rendered client-side only?)', (h1s[0] || '').slice(0, 80));

  const cookies = setCookieHeaders(response.headers);
  check(group, 'no Set-Cookie (anonymous)', pathname, cookies.length === 0,
    `anonymous response sets cookies: ${cookies.map((c) => c.split(';')[0].split('=')[0]).join(', ')}`);

  const cacheControl = response.headers.get('cache-control') || '';
  if (cacheable) {
    check(group, 'cacheable (static or ISR)', pathname, !/private|no-store/i.test(cacheControl),
      `Cache-Control "${cacheControl}": rendered per request, so it read cookies, headers or the session (brief 2.4)`,
      cacheControl);
  }

  if (response.body.includes('BAILOUT_TO_CLIENT_SIDE_RENDERING')) {
    record(group, 'no client-side bailout', pathname, 'WARN',
      'part of the page bailed out to client rendering (useSearchParams outside <Suspense>?); check the main content is in the HTML');
  }

  result.ok = result.title.length > 0 && h1s.length > 0;
  result.body = response.body;
  return result;
}

function checkDistinctTitles(pages) {
  const byTitle = new Map();
  for (const { pathname, title } of pages) {
    if (!title) continue;
    byTitle.set(title, [...(byTitle.get(title) || []), pathname]);
  }
  const duplicates = [...byTitle.entries()].filter(([, paths]) => paths.length > 1);
  const titledCount = pages.filter((p) => p.title).length;
  // With fewer than two titled pages there is nothing to compare, and a PASS
  // would read as evidence when it is not.
  const detail = titledCount < 2
    ? `only ${titledCount} of ${pages.length} routes returned a <title>`
    : duplicates.map(([title, paths]) => `"${title}" on ${paths.join(', ')}`).join('; ');
  check('titles', 'every Tier A/B title distinct', `${pages.length} routes`, titledCount >= 2 && duplicates.length === 0,
    detail, `${byTitle.size} distinct titles across ${titledCount} routes`);
}

async function checkGooglebot(song) {
  const target = `/explore/${song.id}`;
  const response = await page(target, { ua: GOOGLEBOT_UA });
  if (response.status !== 200) {
    fail('googlebot', 'song title in body', target, response.error || `status ${response.status}`);
    return;
  }
  const body = searchableBody(response.body);
  const title = song.title.trim();
  check('googlebot', 'song title in body', target, body.includes(title),
    `"${title}" not found in the ${response.body.length}-byte body served to Googlebot`, `"${title}"`);
  const visible = stripTags(response.body.replace(/<script\b[\s\S]*?<\/script>/gi, ' '));
  check('googlebot', 'song title in visible HTML', target, visible.includes(title),
    `"${title}" appears only inside scripts (RSC payload), not in rendered markup`);
}

async function checkSlugRoute(song) {
  if (!song.slug || song.slug === song.id) return;
  const target = `/explore/${song.slug}`;
  const response = await page(target);
  check('tier-b', 'slug URL resolves', target, response.status === 200,
    response.error || `status ${response.status}; SongDetail resolved slugs as well as ids`);
}

async function checkLocales(pathname) {
  const expectations = [
    { prefix: '', lang: 'en' },
    { prefix: '/zh-CN', lang: 'zh-CN' },
    { prefix: '/zh-TW', lang: 'zh-TW' },
  ];
  for (const { prefix, lang } of expectations) {
    const target = `${prefix}${pathname === '/' ? '' : pathname}` || '/';
    const response = await page(target);
    if (response.status !== 200) {
      fail('locales', `${lang} renders`, target, response.error || `status ${response.status}`);
      continue;
    }
    const htmlLang = extractHtmlLang(response.body);
    check('locales', `${lang} renders with <html lang>`, target, htmlLang === lang, `<html lang="${htmlLang}">, expected "${lang}"`, `lang="${htmlLang}"`);
  }

  // English is unprefixed: /en/x must redirect to /x, never render a second copy.
  const prefixed = `/en${pathname === '/' ? '' : pathname}`;
  const response = await page(prefixed);
  const location = response.headers.get('location') || '';
  const landed = location ? new URL(location, BASE_URL).pathname : '';
  check('locales', 'English unprefixed (/en redirects)', prefixed,
    [301, 302, 307, 308].includes(response.status) && landed === (pathname || '/'),
    response.error || `status ${response.status}${location ? ` -> ${location}` : ''}, expected a redirect to ${pathname}`,
    `${response.status} -> ${landed}`);
}

/**
 * Brief 5.9: the same Tier B page, with and without a Supabase auth cookie,
 * must be byte-identical once nonces and deployment ids are removed. Fetched
 * anonymous, then with the cookie, then anonymous again, so a page that
 * differs on every request is reported as that rather than as a leak.
 */
async function checkCacheLeak(pathname, cookie, cookieKind) {
  const first = await page(pathname);
  const signedIn = await page(pathname, { cookie });
  const second = await page(pathname);
  const target = `${pathname} (${cookieKind})`;
  if ([first, signedIn, second].some((r) => r.status !== 200)) {
    fail('cache-leak', 'identical with and without auth cookie', target,
      `statuses anonymous=${first.status} cookie=${signedIn.status} anonymous=${second.status}`);
    return;
  }
  const a = normalizeForDiff(first.body);
  const b = normalizeForDiff(signedIn.body);
  const c = normalizeForDiff(second.body);
  if (a !== c) {
    fail('cache-leak', 'identical with and without auth cookie', target,
      `two anonymous requests differ, so the page is not a cached render. ${firstDifference(a, c)}`);
    return;
  }
  const difference = firstDifference(a, b);
  check('cache-leak', 'identical with and without auth cookie', target, difference === null,
    `HTML differs with an auth cookie (per-user state in a shared page). ${difference}`, `${a.length} bytes identical`);
}

async function checkAccountGate() {
  const response = await page('/account/billing');
  const location = response.headers.get('location') || '';
  check('auth', '/account gated server-side', '/account/billing',
    [302, 303, 307, 308].includes(response.status) && /[?&]signin=1/.test(location),
    response.error || `status ${response.status}${location ? ` -> ${location}` : ''}, expected a redirect to /?signin=1&next=...`,
    `${response.status} -> ${location}`);
}

// ---------------------------------------------------------------------------

async function runHttpChecks() {
  if (!(await checkServerIsProduction())) return;

  let songs = [];
  let owners = [];
  try {
    ({ songs, owners } = await discoverSongs());
    check('preflight', 'real song ids from the library', API_ORIGIN, songs.length > 0, 'the library returned no usable tracks',
      songs.map((s) => s.id).join(', '));
  } catch (error) {
    fail('preflight', 'real song ids from the library', API_ORIGIN, String(error.message || error));
  }
  const username = process.env.VERIFY_USERNAME || owners[0] || '';
  const firstWord = songs[0]?.artist || songs[0]?.title || 'piano';
  const searchPath = `/explore/search?q=${encodeURIComponent(String(firstWord).split(/\s+/)[0])}`;

  const titled = [];
  for (const route of TIER_A) titled.push(await checkPublicRoute('tier-a', route));
  for (const route of LEGAL) titled.push(await checkPublicRoute('legal', route));

  const tierB = ['/explore', ...songs.map((s) => `/explore/${s.id}`)];
  if (username) tierB.push(`/u/${encodeURIComponent(username)}`);
  else record('tier-b', '/u/:username', '/u/<none>', 'SKIP', 'no creator username: the library exposes no owners. Set VERIFY_USERNAME');
  for (const route of tierB) titled.push(await checkPublicRoute('tier-b', route));
  // Search reads searchParams, so it is necessarily rendered per request.
  titled.push(await checkPublicRoute('tier-b', searchPath, { cacheable: false }));

  checkDistinctTitles(titled);

  for (const song of songs) await checkGooglebot(song);
  if (songs[0]) await checkSlugRoute(songs[0]);

  const localeSamples = [...LOCALE_SAMPLES, ...(songs[0] ? [`/explore/${songs[0].id}`] : [])];
  for (const sample of localeSamples) await checkLocales(sample);

  const realCookie = process.env.VERIFY_AUTH_COOKIE;
  const cookie = realCookie || forgedAuthCookie();
  const cookieKind = realCookie ? 'real session' : 'forged cookie';
  if (!realCookie) {
    record('cache-leak', 'signed-in session tested', 'VERIFY_AUTH_COOKIE', 'WARN',
      'only a forged cookie was sent; set VERIFY_AUTH_COOKIE to a real signed-in Cookie header to test a valid session too');
  }
  for (const route of [...tierB, searchPath]) await checkCacheLeak(route, cookie, cookieKind);

  await checkAccountGate();
}

function printTable() {
  const rows = results.map((r, i) => [String(i + 1), r.group, r.name, r.target, r.status, r.detail.split('\n')[0]]);
  const headers = ['#', 'Group', 'Check', 'Target', 'Result', 'Detail'];
  const widths = headers.map((h, col) => Math.min(col === 5 ? 90 : 48, Math.max(h.length, ...rows.map((row) => row[col].length))));
  const cell = (text, col) => (text.length > widths[col] ? `${text.slice(0, widths[col] - 1)}~` : text.padEnd(widths[col]));
  const line = (row) => row.map(cell).join('  ');
  console.log(line(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of rows) console.log(line(row));

  const failures = results.filter((r) => r.status === 'FAIL' || (r.status === 'SKIP' && !ALLOW_SKIP));
  if (failures.length) {
    console.log('\nFailure details:');
    for (const r of failures) console.log(`\n[${r.status}] ${r.group} / ${r.name} / ${r.target}\n${r.detail}`);
  }

  const count = (status) => results.filter((r) => r.status === status).length;
  console.log(`\n${count('PASS')} PASS, ${count('FAIL')} FAIL, ${count('WARN')} WARN, ${count('SKIP')} SKIP, ${count('PENDING')} PENDING`);
  console.log(failures.length ? 'RESULT: FAIL' : 'RESULT: PASS');
  return failures.length === 0;
}

async function main() {
  console.log(`GrooveSheet migration verify: BASE_URL=${BASE_URL}, API_ORIGIN=${API_ORIGIN}${CUTOVER ? ', cutover mode' : ''}\n`);
  if (!args.has('--http-only')) {
    checkGetSession();
    checkPrerenderNotInBuild();
    checkVercelUaRewrites();
    if (!args.has('--skip-toolchain')) {
      runTool('tsc', 'npx', ['tsc', '--noEmit', '-p', ROOT]);
      runTool('eslint', 'npx', ['eslint', '.']);
      runTool('vitest (incl. transport, osmdPlaybackClock)', 'npx', ['vitest', 'run']);
    }
  }
  if (!args.has('--static-only')) await runHttpChecks();

  const ok = printTable();
  if (args.has('--json')) console.log(JSON.stringify({ ok, results }));
  process.exitCode = ok ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
