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

// When there's no SESSION_SECRET, the key comes from the password — stretched (PBKDF2, 200k rounds)
// so a stolen cookie can't be used to guess the password quickly offline.
let keyCache: { src: string; key: CryptoKey } | null = null;
async function signingKey(): Promise<CryptoKey> {
  const src = secret();
  if (keyCache?.src === src) return keyCache.key;
  let raw: BufferSource = enc.encode(src) as BufferSource;
  if (!process.env.SESSION_SECRET) {
    const base = await crypto.subtle.importKey("raw", enc.encode(src), "PBKDF2", false, ["deriveBits"]);
    raw = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode("kndl-session-v2"), iterations: 200_000, hash: "SHA-256" }, base, 256);
  }
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  keyCache = { src, key };
  return key;
}

async function hmac(data: string): Promise<string> {
  const key = await signingKey();
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
