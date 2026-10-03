import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/app/internal/_lib/session";

export const runtime = "nodejs";

/* POSTed by the plain <form> in the user menu, so signing out works without
   JavaScript and cannot be triggered by a stray GET. */
export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/internal/login", req.url), { status: 303 });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
