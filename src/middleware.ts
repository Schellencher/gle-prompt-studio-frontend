import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "__gle_maint";

export function middleware(req: NextRequest) {
  const mode = String(process.env.MAINTENANCE_MODE || "")
    .trim()
    .toLowerCase();
  const enabled = mode === "1" || mode === "true" || mode === "on";

  if (!enabled) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Allow Next static + maintenance routes + common public files
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.json" ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/maintenance") ||
    pathname.startsWith("/unlock")
  ) {
    return NextResponse.next();
  }

  const token = String(process.env.MAINTENANCE_TOKEN || "").trim();
  const cookie = req.cookies.get(COOKIE)?.value || "";

  // If admin cookie matches token -> allow
  if (token && cookie === token) return NextResponse.next();

  // Otherwise redirect to maintenance
  const url = req.nextUrl.clone();
  url.pathname = "/maintenance";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
