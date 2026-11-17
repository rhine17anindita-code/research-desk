import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Outbound requests to addresses we didn't choose (feeds, article links, pasted URLs) must only ever
 * reach the public internet — never this server, the hosting network or cloud metadata (SSRF).
 */

function privateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return privateV4(ip);
  if (v === 6) {
    const x = ip.toLowerCase();
    const mapped = x.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return privateV4(mapped[1]);
    const hex = x.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/); // the same, written in hex
    if (hex) { const a = parseInt(hex[1], 16), b = parseInt(hex[2], 16); return privateV4(`${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`); }
    return x === "::" || x === "::1" || /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith("ff") || x.startsWith("64:ff9b");
  }
  return true;
}

/** Throws unless the URL is http(s) and its host resolves only to public addresses. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error("Not a valid link"); }
  if (!/^https?:$/.test(u.protocol)) throw new Error("Only http(s) links");
  const host = u.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Private address");
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Private address");
    return u;
  }
  if (process.env.VITEST) return u; // tests stub the network
  const addrs = await lookup(host, { all: true }).catch(() => { throw new Error("Address not found"); });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("Private address");
  return u;
}

/** fetch() that follows at most 5 redirects itself, re-checking every hop is public. */
export async function safeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= 5; hop++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current).toString();
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects");
}
