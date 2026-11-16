import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { getAllSettings, setSetting } from "@/lib/repo/settings";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings-defaults";

export const GET = route(() => ({ ok: true, settings: getAllSettings(getDb()) }));

/** Only known keys are accepted; values are type-checked against the defaults. API keys are never stored here. */
export const PATCH = route(async (req: Request) => {
  const b = await body<Partial<AppSettings>>(req);
  const db = getDb();
  for (const [k, v] of Object.entries(b)) {
    if (!(k in DEFAULT_SETTINGS)) throw new Error(`Unknown setting ${k}`);
    const def = DEFAULT_SETTINGS[k as keyof AppSettings];
    if (typeof def !== typeof v || (Array.isArray(def) && !Array.isArray(v))) throw new Error(`Invalid value for ${k}`);
    if (typeof v === "number" && (!Number.isFinite(v) || v < 0)) throw new Error(`Invalid value for ${k}`);
    setSetting(db, k as keyof AppSettings, v as never);
  }
  return { ok: true, settings: getAllSettings(db) };
});
