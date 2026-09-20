/* Password check and the server-component view of who is signed in.

   Node runtime only: scrypt comes from node:crypto. The middleware does not
   import this file, it imports ./session.ts, which is Web Crypto throughout.

   Accounts live in INTERNAL_USERS, a JSON map of username to a scrypt hash.
   Mint one with:  node scripts/internal-user-hash.mjs <password>

   The hash is `scrypt:salt:key`, colon separated. The conventional `$`
   separator cannot be used here: these hashes are delivered as an environment
   variable, and Next.js runs .env files through dotenv-expand, which reads
   `$19e721...` as a variable reference and substitutes an empty string. That
   silently truncates every hash to "scrypt" and locks both accounts out, with
   nothing in the logs to say why. */
import { scrypt as scryptCb, timingSafeEqual, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "./session";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

const KEY_LEN = 64;

export function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return scrypt(password, salt, KEY_LEN).then(
    (derived) => `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`
  );
}

/** False for an unknown user, a malformed hash, or a wrong password. */
export async function checkPassword(user: string, password: string): Promise<boolean> {
  const users = readUsers();
  const stored = users[user];

  /* Always run the KDF, even when the user does not exist, so the response
     time does not reveal which usernames are real. */
  const [scheme, saltHex, hashHex] = (stored ?? "scrypt:00:00").split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  /* Buffer.from(_, "hex") truncates rather than throwing on a malformed hash,
     so the length check below is what rejects one. timingSafeEqual throws on
     mismatched lengths, which would be a 500 instead of a failed sign in. */
  const expected = Buffer.from(hashHex, "hex");
  const derived = await scrypt(password, Buffer.from(saltHex, "hex"), KEY_LEN);

  if (!stored) return false;
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

function readUsers(): Record<string, string> {
  const raw = process.env.INTERNAL_USERS;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------
   Shared-password mode.

   INTERNAL_PASSWORD set: one password for the team, and the person says which
   of them they are at the login screen. That name is attribution, not
   authentication: see _lib/editors.ts. It exists so the approved_by recorded
   against a published post means something.

   The plaintext lives in the environment rather than as a hash because the
   whole point here was to remove the hashing step. It never enters the repo.
   ------------------------------------------------------------------ */

export function sharedPasswordMode(): boolean {
  return Boolean(process.env.INTERNAL_PASSWORD);
}

export function checkSharedPassword(password: string): boolean {
  const expected = process.env.INTERNAL_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(password, "utf8");
  const b = Buffer.from(expected, "utf8");
  // timingSafeEqual throws on a length mismatch, which would leak the length.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isConfigured(): boolean {
  if (sharedPasswordMode()) return true;
  return Object.keys(readUsers()).length > 0;
}

/** The signed-in user, for server components. Null when signed out. */
export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}
