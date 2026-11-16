import { NextResponse } from "next/server";
import { authMode, createSessionToken, safeEqual, SESSION_COOKIE, SESSION_DAYS } from "@/lib/auth";

// Simple in-memory throttle: 8 failed attempts per IP per 15 minutes.
const attempts = new Map<string, { n: number; until: number }>();

export async function POST(req: Request) {
  if (authMode() !== "password") return NextResponse.json({ ok: true });
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const now = Date.now();
  const rec = attempts.get(ip);
  if (rec && rec.until > now && rec.n >= 8) {
    return NextResponse.json({ ok: false, message: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  let password = "";
  try {
    password = String(((await req.json()) as { password?: string }).password ?? "");
  } catch {
    /* empty */
  }
  if (!safeEqual(password, process.env.SITE_PASSWORD ?? "")) {
    const cur = rec && rec.until > now ? rec : { n: 0, until: now + 15 * 60_000 };
    cur.n++;
    attempts.set(ip, cur);
    return NextResponse.json({ ok: false, message: "Wrong password." }, { status: 401 });
  }
  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return res;
}
