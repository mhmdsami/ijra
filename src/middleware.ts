import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { isLocalPreview } from "@/lib/local-preview";

export function middleware(req: NextRequest) {
  if (isLocalPreview()) return NextResponse.next();
  const hasSession = !!getSessionCookie(req);
  if (req.nextUrl.pathname === "/login") {
    if (hasSession) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }
  if (!hasSession) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(req.nextUrl.pathname)}`, req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|opengraph-image.png|api/auth|api/internal/answer).*)"],
};
