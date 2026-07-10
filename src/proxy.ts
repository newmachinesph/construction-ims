import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";

/**
 * Next 16 renamed `middleware` to `proxy` (nodejs runtime). This is a cheap
 * gate only: it bounces anyone without a session cookie away from protected
 * routes. Real authorization — role and per-document checks — happens in the
 * Data Access Layer on every page and API call. A forged cookie gets past
 * here and is rejected there.
 */
const PUBLIC_PATHS = new Set(["/login", "/forbidden"]);

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/") {
    return NextResponse.redirect(new URL(hasSession ? "/dashboard" : "/login", request.url));
  }

  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!hasSession && !isPublic) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Skip static assets, image optimizer, favicon and all /api routes (those
  // authorize themselves via requireUser/requirePermission).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
