import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

/**
 * Optimistic check only (is there a session cookie?), to send signed-out visitors to the sign-in
 * page. Every API route still verifies the session and permissions itself. Signed-in visitors on
 * /login are handled by the page, which checks the real session (a revoked session still has a
 * cookie, and bouncing it away from /login would loop).
 */
export function proxy(req: NextRequest) {
  const signedIn = Boolean(getSessionCookie(req));
  const onLogin = req.nextUrl.pathname === "/login";
  if (!signedIn && !onLogin) {
    const url = new URL("/login", req.url);
    const next = req.nextUrl.pathname + req.nextUrl.search;
    if (next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: not API routes, Next's assets, or files in public/ (anything with an extension).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
