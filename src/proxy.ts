import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

// Page-level UX redirect only (Next.js 16 renamed middleware -> proxy).
// This is NOT the security boundary — every API route verifies the
// session itself via getSessionUser()/requireAdmin() in src/lib/session.ts,
// per Next's own guidance that Proxy can be bypassed and must not be the
// sole authorization check.
//
// /dashboard/* is browsable by guests (read-only catalog), so it is NOT
// gated here — login-only actions (rate, log a play, playlists) are
// enforced by requireUser() inside their own API routes instead. Only
// /admin/* is redirected at the page level, as a UX convenience; the real
// enforcement for every admin API route is requireAdmin().
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (pathname.startsWith("/admin") && (!session || session.role !== "admin")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
