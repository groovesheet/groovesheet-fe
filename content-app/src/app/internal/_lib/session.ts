/* Session token: `base64url(payload).base64url(HMAC-SHA256(payload))`.

   Written with Web Crypto only, deliberately: middleware.ts runs on the Edge
   runtime and cannot use node:crypto, while the route handlers run on Node.
   One implementation keeps the two from drifting apart, which would lock
   everybody out of the portal in exactly the way that is hardest to debug. */

export const SESSION_COOKIE = "groovesheet_internal";
export const SESSION_DAYS = 30;

export type SessionPayload = {
  /** Username. Commission attribution depends on this. */
  user: string;
  /** Unix seconds. */
  exp: number;
};

/* HMAC key for the session cookie.

   INTERNAL_SESSION_SECRET is the good answer and takes precedence. When it is
   absent we derive the key from the sign-in credential instead, so a
   deployment only has to set one secret rather than two. HMAC hashes its key
   material, so a password works as key material directly, and no scrypt is
   needed: this module also runs on the Edge runtime in middleware.ts, where
   node:crypto is unavailable.

   The tradeoff, which is the desirable one: changing the password changes the
   key, so every existing session is invalidated on a password rotation. */
function secret(): string {
  const explicit = process.env.INTERNAL_SESSION_SECRET;
  if (explicit) return explicit;
  const derived = process.env.INTERNAL_PASSWORD || process.env.INTERNAL_USERS;
  if (derived) return `groovesheet-internal-session-v1:${derived}`;
  throw new Error("Set INTERNAL_PASSWORD (or INTERNAL_SESSION_SECRET)");
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* Returns an ArrayBuffer rather than a Uint8Array: crypto.subtle wants a
   BufferSource, and a Uint8Array over an ArrayBufferLike does not satisfy that
   under TypeScript 5.7's stricter typed-array generics. */
function b64urlDecode(s: string): ArrayBuffer {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await key(), new TextEncoder().encode(body));
  return `${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

/** Null on a bad signature, a malformed token, or an expired one. */
export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    /* crypto.subtle.verify is constant-time, which is the reason to use it
       here rather than comparing two strings. */
    const ok = await crypto.subtle.verify(
      "HMAC",
      await key(),
      b64urlDecode(sig),
      new TextEncoder().encode(body)
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as SessionPayload;
    if (typeof payload.user !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionExpiry(): number {
  return Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60;
}
