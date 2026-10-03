/* Sign in. The only unauthenticated endpoint under /api/internal.

   Node runtime: the scrypt comparison in _lib/auth.ts needs node:crypto. */
import { NextResponse } from "next/server";
import {
  checkPassword,
  checkSharedPassword,
  isConfigured,
  sharedPasswordMode,
} from "@/app/internal/_lib/auth";
import { DEFAULT_EDITOR, isEditor } from "@/app/internal/_lib/editors";
import { SESSION_COOKIE, SESSION_DAYS, sessionExpiry, signSession } from "@/app/internal/_lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Sign in is not configured on this deployment." },
      { status: 503 }
    );
  }

  let body: { user?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    return NextResponse.json({ error: "A password is required." }, { status: 400 });
  }

  /* Shared-password mode: the password is what grants access, and the name
     that comes with it only decides who the work gets attributed to. An
     unrecognised name falls back to the default rather than being trusted. */
  let user: string;
  if (sharedPasswordMode()) {
    if (!checkSharedPassword(password)) {
      return NextResponse.json({ error: "Wrong password." }, { status: 401 });
    }
    const claimed = typeof body.user === "string" ? body.user.trim() : "";
    user = isEditor(claimed) ? claimed : DEFAULT_EDITOR;
  } else {
    user = typeof body.user === "string" ? body.user.trim() : "";
    if (!user) {
      return NextResponse.json({ error: "A username is required." }, { status: 400 });
    }
    if (!(await checkPassword(user, password))) {
      // One message for both cases, so this cannot enumerate accounts.
      return NextResponse.json({ error: "Wrong username or password." }, { status: 401 });
    }
  }

  const token = await signSession({ user, exp: sessionExpiry() });
  const res = NextResponse.json({ ok: true, user });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}
