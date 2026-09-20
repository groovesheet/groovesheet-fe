#!/usr/bin/env node
/* Applies src/lib/content/schema.sql.
 *
 * The obvious way is `psql "$DATABASE_URL_SESSION" -f src/lib/content/schema.sql`,
 * and that is still fine if you have psql. It is not installed by default on
 * macOS and pulling in all of Postgres to run one file is a poor trade, so
 * this does the same job with the `pg` driver this app already depends on.
 *
 *   node scripts/apply-schema.mjs
 *   node scripts/apply-schema.mjs "postgresql://..."   # explicit, wins over .env.local
 *
 * The file is idempotent: every statement is CREATE ... IF NOT EXISTS, ALTER
 * ... ADD COLUMN IF NOT EXISTS, or a DROP-then-ADD of one CHECK constraint.
 * Run it as often as you like, and run it again after pulling a change to it.
 *
 * Use the SESSION pooler URL (port 5432 on Supabase), not the transaction
 * pooler the app uses. The transaction pooler does not keep a session across
 * statements, which is what DDL in one file needs. The direct host is IPv6
 * only, so it works from a laptop and not from Vercel; prefer the poolers for
 * both.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");

/** DATABASE_URL_SESSION from the argument, the environment, or .env.local. */
function connectionString() {
  const fromArg = process.argv[2];
  if (fromArg) return { url: fromArg, source: "the command line" };
  if (process.env.DATABASE_URL_SESSION)
    return { url: process.env.DATABASE_URL_SESSION, source: "the environment" };
  try {
    const env = readFileSync(join(APP, ".env.local"), "utf8");
    const line = env.split("\n").find((l) => l.startsWith("DATABASE_URL_SESSION="));
    const value = line?.slice("DATABASE_URL_SESSION=".length).trim().replace(/^"|"$/g, "");
    if (value) return { url: value, source: ".env.local" };
  } catch {
    /* No .env.local. The error below says what to do. */
  }
  return null;
}

/* Say which database is about to be changed, without printing the password.
   Applying the schema to the wrong project is a quiet mistake to make and a
   tedious one to undo. */
function describe(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return "an unparseable connection string";
  }
}

const found = connectionString();
if (!found) {
  console.error(
    "No DATABASE_URL_SESSION.\n" +
      "Set it in content-app/.env.local, or pass it as an argument:\n" +
      '  node scripts/apply-schema.mjs "postgresql://..."\n' +
      "On Supabase use the SESSION pooler (port 5432), not the transaction pooler.",
  );
  process.exit(1);
}

const sql = readFileSync(join(APP, "src", "lib", "content", "schema.sql"), "utf8");
const local = /^(localhost|127\.0\.0\.1|::1)$/.test(new URL(found.url).hostname);

const client = new pg.Client({
  connectionString: found.url,
  ssl: local ? undefined : { rejectUnauthorized: false },
});

console.log(`Applying schema.sql to ${describe(found.url)} (from ${found.source})`);

try {
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name LIKE 'content_%'
     ORDER BY table_name`,
  );
  console.log(`Done. Tables now present: ${rows.map((r) => r.table_name).join(", ") || "none"}`);
  if (rows.length !== 5) {
    console.warn(
      "Expected five content_ tables (drafts, media, news, runs, social). Check the output above.",
    );
  }
} catch (err) {
  console.error(`Failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
