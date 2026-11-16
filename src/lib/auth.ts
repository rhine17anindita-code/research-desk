/**
 * Single-password site protection. Uses only Web Crypto so it works in both
 * the Edge middleware and Node route handlers.
 *
 * - SITE_PASSWORD set           → every page and API needs a signed session cookie.
 * - SITE_PASSWORD unset, dev     → open (local use).
 * - SITE_PASSWORD unset, prod    → locked with an explanatory message, unless
 *                                  ALLOW_OPEN_ACCESS=true is set deliberately.
 */

export const SESSION_COOKIE = "rd_session";
export const SESSION_DAYS = 30;

export type AuthMode = "password" | "open" | "misconfigured";

export function authMode(): AuthMode {
  if (process.env.SITE_PASSWORD) return "password";
  if (process.env.NODE_ENV !== "production" || process.env.ALLOW_OPEN_ACCESS === "true") return "open";
  return "misconfigured";
}

function secret(): string {
  return process.env.SESSION_SECRET || `rd:${process.env.SITE_PASSWORD ?? ""}`;
}

const enc = new TextEncoder();

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const A = enc.encode(a);
  const B = enc.encode(b);
  let diff = A.length ^ B.length;
  for (let i = 0; i < Math.max(A.length, B.length); i++) diff |= (A[i] ?? 0) ^ (B[i] ?? 0);
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  return `${expires}.${await hmac(String(expires))}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(exp));
}
