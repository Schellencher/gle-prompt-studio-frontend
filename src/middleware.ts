import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const mode = (process.env.MAINTENANCE_MODE || "").trim();
  if (mode !== "1") return NextResponse.next();

  const p = req.nextUrl.pathname;

  // erlaubt: Wartungsseite + Next assets
  if (
    p === "/maintenance" ||
    p.startsWith("/_next") ||
    p === "/favicon.ico" ||
    p === "/manifest.json" ||
    p.startsWith("/icons")
  ) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/maintenance";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/:path*"],
};
