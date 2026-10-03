/* Gate on /internal and /api/internal.

   Behind this sit unpublished drafts, the pipeline's own run history, and the
   controls that post to GrooveSheet's LinkedIn, Facebook, Instagram and
   Pinterest accounts. An unauthenticated caller who reached /api/internal
   could publish to all four. Nothing here is allowed out. */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/app/internal/_lib/session";

export const config = {
  matcher: ["/internal/:path*", "/api/internal/:path*"],
};

/** Stamped on every response from this section, belt and braces with the
    per-page `robots: { index: false }` metadata. */
function noindex(res: NextResponse): NextResponse {
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // The only unauthenticated page, plus the form it posts to.
  if (pathname === "/internal/login" || pathname === "/api/internal/login") {
    return noindex(NextResponse.next());
  }

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return noindex(NextResponse.next());

  // An expired API call should not be answered with a login page.
  if (pathname.startsWith("/api/")) {
    return noindex(
      NextResponse.json({ error: "Not signed in" }, { status: 401 })
    );
  }

  const login = req.nextUrl.clone();
  login.pathname = "/internal/login";
  login.search = "";
  // Come back to where they were headed once signed in.
  if (pathname !== "/internal") login.searchParams.set("next", pathname + search);
  return noindex(NextResponse.redirect(login));
}
