import { getDb } from "@/lib/db";
import { body, json, route } from "@/lib/http";
import { verifyHelper } from "@/lib/helper-auth";
import { saveTranslation, type TKind } from "@/lib/translate";

/** The Mac helper hands over English translations of Bangla content. */
export const POST = route(async (req: Request) => {
  if (!verifyHelper(req)) return json({ ok: false, message: "Not signed by the helper" }, 401);
  const b = await body<{ kind: TKind; id: string; parts: string[]; model?: string }>(req);
  if (!["transcript", "article", "research", "voice"].includes(b.kind) || !Array.isArray(b.parts)) throw new Error("Bad translation");
  saveTranslation(getDb(), b.kind, b.id, b.parts, b.model ?? "nllb-200-distilled-600M");
  return { ok: true };
});
