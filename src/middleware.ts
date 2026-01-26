// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const mode = (process.env.MAINTENANCE_MODE || "").trim();

  // Wartung aus -> alles normal
  if (mode !== "1") return NextResponse.next();

  const p = req.nextUrl.pathname;

  // Immer erlaubt: Next Assets + Basics + (optional) /api
  if (
    p.startsWith("/_next/") ||
    p.startsWith("/api/") ||
    p === "/favicon.ico" ||
    p === "/manifest.json" ||
    p.startsWith("/icons") ||
    p === "/robots.txt" ||
    p === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  // Wartungs-HTML direkt zurückgeben (keine /maintenance Route nötig)
  const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>GLE Prompt Studio – Wartung</title>
  <style>
    :root{color-scheme:dark}
    body{
      margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      font-family:-apple-system,system-ui,Segoe UI,Roboto,Arial,sans-serif;
      background:#050608;color:#e9f6ff;
    }
    .box{
      max-width:520px;padding:28px;border:1px solid rgba(255,255,255,.10);
      border-radius:18px;background:rgba(18,18,24,.65);backdrop-filter: blur(14px);
      text-align:center;box-shadow: 0 10px 30px rgba(0,0,0,.35);
    }
    h1{margin:0 0 10px;font-size:22px;color:#00e676}
    p{margin:0;opacity:.85;line-height:1.6}
    .small{margin-top:10px;font-size:12px;opacity:.6}
  </style>
</head>
<body>
  <div class="box">
    <h1>🛠️ Update läuft</h1>
    <p>GLE Prompt Studio wird gerade aktualisiert.</p>
    <p>Bitte später erneut versuchen.</p>
    <div class="small">Status: 503 (Maintenance)</div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export const config = {
  matcher: ["/:path*"],
};
