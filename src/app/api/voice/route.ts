import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { getProfile, listVoiceSources, updateProfile, type VoiceProfile } from "@/lib/voice";

export const GET = route(() => {
  const db = getDb();
  return { ok: true, profile: getProfile(db), sources: listVoiceSources(db).map(({ text, ...s }) => ({ ...s, preview: text?.slice(0, 400) ?? null })) };
});

/** Save guides, dials, presets or banned phrases. */
export const PATCH = route(async (req: Request) => {
  const { guideMine, guideInspiration, dials, presets, banned } = await body<Partial<VoiceProfile>>(req);
  return { ok: true, profile: updateProfile(getDb(), Object.fromEntries(Object.entries({ guideMine, guideInspiration, dials, presets, banned }).filter(([, v]) => v !== undefined))) };
});
