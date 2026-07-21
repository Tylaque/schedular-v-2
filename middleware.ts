import { auth } from "@/auth";
import { NextResponse } from "next/server";

const ADMIN_ONLY_ROUTES = [
  "/admin/my-area",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  const role = (req.auth.user as any)?.role;

  // "admin" role can only access /admin/my-area and its children
  if (role === "admin" && !ADMIN_ONLY_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/admin/my-area", req.url));
  }

  // "super_admin" and "org_owner" can access everything under /admin

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
