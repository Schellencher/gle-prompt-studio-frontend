// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";

const BYPASS_COOKIE = "gle_bypass"; // httpOnly: echter Zugriff (Middleware)
const BYPASS_UI_COOKIE = "gle_bypass_ui"; // client-lesbar: nur UI/Debug
const BYPASS_PARAM = "bypass";
const RESET_PARAM = "resetBypass";

export function middleware(req: NextRequest) {
  const mode = (process.env.MAINTENANCE_MODE || "").trim();
  const BYPASS = (process.env.MAINTENANCE_BYPASS_TOKEN || "").trim();

  // Wartung aus -> durchlassen
  if (mode !== "1") return NextResponse.next();

  const p = req.nextUrl.pathname;

  // ✅ RESET BYPASS (muss VOR der Allowlist stehen!)
  const reset =
    req.nextUrl.searchParams.get(BYPASS_PARAM) === "0" ||
    req.nextUrl.searchParams.get(RESET_PARAM) === "1";

  if (reset) {
    const url = req.nextUrl.clone();
    url.pathname = "/maintenance";
    url.search = "";

    const res = NextResponse.redirect(url);
    res.cookies.set(BYPASS_COOKIE, "", { path: "/", maxAge: 0 });
    res.cookies.set(BYPASS_UI_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  // Allowlist: Wartungsseite + Next assets + Basics
  if (
    p === "/maintenance" ||
    p.startsWith("/_next") ||
    p === "/favicon.ico" ||
    p === "/manifest.json" ||
    p.startsWith("/icons") ||
    p === "/robots.txt" ||
    p === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  // Optional: /api nicht blocken (falls du später Next API Routes nutzt)
  if (p.startsWith("/api")) return NextResponse.next();

  // ✅ Wartungs-Bypass
  if (BYPASS) {
    const q = (req.nextUrl.searchParams.get(BYPASS_PARAM) || "").trim();
    const c = (req.cookies.get(BYPASS_COOKIE)?.value || "").trim();

    if (q === BYPASS || c === BYPASS) {
      // Wenn über URL-BYPASS reingekommen: Cookies setzen + URL bereinigen
      if (q === BYPASS && c !== BYPASS) {
        const clean = req.nextUrl.clone();
        clean.searchParams.delete(BYPASS_PARAM);

        const res = NextResponse.redirect(clean);
        const secure = process.env.NODE_ENV === "production";

        // httpOnly Cookie für Middleware
        res.cookies.set(BYPASS_COOKIE, BYPASS, {
          httpOnly: true,
          sameSite: "lax",
          secure,
          path: "/",
          maxAge: 60 * 60 * 24 * 7, // 7 Tage
        });

        // UI Cookie (damit Client erkennt: bypass aktiv)
        res.cookies.set(BYPASS_UI_COOKIE, "1", {
          httpOnly: false,
          sameSite: "lax",
          secure,
          path: "/",
          maxAge: 60 * 60 * 24 * 7, // 7 Tage
        });

        return res;
      }

      // Cookie war schon da -> einfach durchlassen
      return NextResponse.next();
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
