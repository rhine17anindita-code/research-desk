import { NextResponse, type NextRequest } from "next/server";
import { authMode, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/login", "/api/logout", "/manifest.webmanifest", "/icon.svg"];
// The Mac helper signs its own requests (checked in each route), so these skip the session check.
// An explicit list, so a new route under /api/helper/ never skips the password by accident.
const HELPER_PATHS = ["/api/helper/jobs", "/api/helper/transcript", "/api/helper/media", "/api/helper/page", "/api/helper/translation", "/api/helper/import", "/api/helper/wake", "/api/helper/health"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // Block cross-site writes (CSRF): a state-changing request must come from this site.
  if (isApi && req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    if (origin) {
      const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
      if (!host || new URL(origin).host !== host) return NextResponse.json({ ok: false, message: "Cross-site request blocked" }, { status: 403 });
    }
  }

  const mode = authMode();
  if (mode === "open" || PUBLIC_PATHS.includes(pathname) || HELPER_PATHS.includes(pathname)) return NextResponse.next();

  if (mode === "misconfigured") {
    const msg = "This site is locked: set SITE_PASSWORD in the server's environment variables (or ALLOW_OPEN_ACCESS=true to run without a password).";
    return isApi ? NextResponse.json({ ok: false, message: msg }, { status: 503 }) : new NextResponse(msg, { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  if (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (isApi) return NextResponse.json({ ok: false, message: "Please sign in again." }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
