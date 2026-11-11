import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Quick check only: send signed-out visitors to sign in before loading private pages.
// Each page still verifies the session and role on the server.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/signin", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/write", "/editor/:path*", "/me/:path*", "/settings", "/reading-list", "/admin/:path*", "/notifications", "/welcome/:path*"],
};
