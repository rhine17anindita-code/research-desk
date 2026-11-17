import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { setSecret } from "@/lib/secrets";
import { setSetting } from "@/lib/repo/settings";

/** Save (or remove) a connection key. Keys are stored on the server and never sent back. */
export const POST = route(async (req: Request) => {
  const b = await body<{ supadataKey?: string | null; monthlyCap?: number }>(req);
  const db = getDb();
  if (b.supadataKey !== undefined) {
    const k = b.supadataKey?.trim() || null;
    if (k && !/^[\w.-]{16,200}$/.test(k)) throw new Error("That doesn't look like an API key");
    if (k) {
      // Check it works before saving (a 1-credit test on a short public video).
      const r = await fetch("https://api.supadata.ai/v1/transcript?url=https://youtu.be/dQw4w9WgXcQ&text=true", { headers: { "x-api-key": k }, signal: AbortSignal.timeout(30000) });
      if (r.status === 401 || r.status === 403) throw new Error("Supadata didn't accept that key — copy it again from your Supadata dashboard");
    }
    setSecret(db, "SUPADATA_API_KEY", k);
  }
  if (b.monthlyCap !== undefined) {
    const n = Math.round(Number(b.monthlyCap));
    if (!(n >= 0 && n <= 100000)) throw new Error("Choose a number of transcripts per month");
    setSetting(db, "transcripts.monthly_cap", n);
  }
  return { ok: true };
});
