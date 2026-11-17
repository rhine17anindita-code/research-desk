import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The Mac helper proves it belongs to this site by signing each request with a secret both
 * sides already have (HELPER_SECRET if set, else the YouTube API key). No password involved.
 */
export function helperSecret(): string | null {
  return process.env.HELPER_SECRET?.trim() || process.env.YOUTUBE_API_KEY?.trim() || null;
}

export function signHelper(secret: string, ts: string, path: string): string {
  return createHmac("sha256", secret).update(`${ts}.${path}`).digest("hex");
}

export function verifyHelper(req: Request): boolean {
  const secret = helperSecret();
  if (!secret) return false;
  const ts = req.headers.get("x-helper-ts") ?? "";
  const sig = req.headers.get("x-helper-sig") ?? "";
  if (!/^\d+$/.test(ts) || Math.abs(Date.now() - Number(ts)) > 5 * 60_000) return false;
  const want = signHelper(secret, ts, new URL(req.url).pathname);
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(want, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
