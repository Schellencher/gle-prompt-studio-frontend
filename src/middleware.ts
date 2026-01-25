import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const mode = (process.env.MAINTENANCE_MODE || "").trim();
  const BYPASS = (process.env.MAINTENANCE_BYPASS_TOKEN || "").trim();

  // Wartung aus -> durchlassen
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

  // ✅ Wartungs-Bypass
  if (BYPASS) {
    const q = req.nextUrl.searchParams.get("bypass");
    const c = req.cookies.get("gle_bypass")?.value;

    if (q === BYPASS || c === BYPASS) {
      const res = NextResponse.next();

      // Cookie setzen, wenn per URL-BYPASS reingekommen
      if (q === BYPASS && c !== BYPASS) {
        res.cookies.set("gle_bypass", BYPASS, {
          httpOnly: true,
          sameSite: "lax",
          secure: true,
          path: "/",
        });
      }

      return res;
    }
  }

  // Default: auf Wartung
  const url = req.nextUrl.clone();
  url.pathname = "/maintenance";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/:path*"],
};
