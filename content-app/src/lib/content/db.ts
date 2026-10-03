/* Postgres access for the content pipeline.

   A pool of its own rather than the portal Store: the pipeline has no file
   store fallback (a cron that writes to .data/ on Vercel would fail anyway),
   and the public blog reads through here, which the portal Store is not meant
   to serve. Small on purpose: the transaction pooler is shared with the portal. */
import type { Pool } from "pg";

let poolPromise: Promise<Pool> | null = null;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/* A database on this machine speaks no SSL, and pg fails the connection
   outright rather than falling back. Matching the literal string "localhost"
   is not enough: a URL written against 127.0.0.1, ::1 or host.docker.internal
   is just as local and gets "The server does not support SSL connections",
   which reads like a server fault rather than a connection-string one. */
function isLocal(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
  } catch {
    return false;
  }
}

async function pool(): Promise<Pool> {
  if (!poolPromise) {
    poolPromise = (async () => {
      const { default: pg } = await import("pg");
      return new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: isLocal(process.env.DATABASE_URL) ? undefined : { rejectUnauthorized: false },
        max: 2,
        connectionTimeoutMillis: 8000,
      });
    })();
  }
  return poolPromise;
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!hasDatabase()) throw new Error("DATABASE_URL is not set");
  const p = await pool();
  const res = await p.query(sql, params);
  return res.rows as T[];
}
