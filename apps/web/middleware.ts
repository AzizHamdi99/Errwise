import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("ew_access")?.value;
  const pathname = request.nextUrl.pathname;

  // /verify-email and /reset-password are opened from a link in an email, usually without a
  // session. Someone who forgot their password is not signed in either.
  const publicRoutes = [
    "/",
    "/login",
    "/register",
    "/verify-email",
    "/forgot-password",
    "/reset-password",
  ];

  const isPublicRoute = publicRoutes.includes(pathname);

  // Not authenticated
  if (!token && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Already authenticated
  if (
    token &&
    (pathname === "/login" || pathname === "/register" || pathname === "/")
  ) {
    return NextResponse.redirect(new URL("/organizations", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|v1|_next|_vercel|.*\\..*).*)"],
};
