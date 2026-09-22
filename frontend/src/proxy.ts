import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/cookies";

/**
 * Cheap cookie-presence gate only. Signature and revocation are checked in the
 * route/page itself (`getCurrentUser`), because proxy runs on every matched
 * request and must not hit the database.
 */
// Checkout stays open to guests: forcing an account before paying is the
// single most reliable way to lose a sale.
// `/admin` is here for the redirect only. The role is never checked at this
// layer — proxy runs on every request and must not hit the database, and a
// cookie's presence says nothing about what it grants. Every admin endpoint is
// behind the API's admin policy, which is the control that matters.
const PROTECTED_PREFIXES = ["/account", "/admin"];
const PUBLIC_ACCOUNT_ROUTES = [
  "/account/login",
  "/account/register",
  "/account/lost-password",
];

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_ACCOUNT_ROUTES.includes(pathname)) return NextResponse.next();

  const needsAuth = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!needsAuth) return NextResponse.next();

  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const loginUrl = new URL("/account/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Skip static assets, the service worker and the manifest: matching them adds
  // latency to every asset fetch and can break precaching.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|catalog/|assets/).*)",
  ],
};
