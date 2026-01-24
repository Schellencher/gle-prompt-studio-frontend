import { NextRequest, NextResponse } from "next/server";
const COOKIE = "gle_maint_unlock";

export async function POST(req: NextRequest) {
  const envToken = process.env.MAINTENANCE_TOKEN || "";
  const form = await req.formData();
  const token = String(form.get("token") || "");

  if (!envToken || token !== envToken) {
    return NextResponse.redirect(new URL("/maintenance?bad=1", req.url));
  }

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(COOKIE, envToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
