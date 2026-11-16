import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { newId, nowIso } from "@/lib/ids";

export const POST = route(async (req: Request) => {
  const b = await body<{ name?: string; action: "boost" | "bury" | "hide"; field?: string; pattern: string; weight?: number }>(req);
  if (!b.pattern?.trim()) throw new Error("A rule needs a word or phrase to match");
  if (!["boost", "bury", "hide"].includes(b.action)) throw new Error("Unknown rule action");
  const id = newId("rule");
  getDb().prepare("INSERT INTO rules (id, name, action, field, pattern, weight, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)")
    .run(id, b.name?.trim() || `${b.action} “${b.pattern.trim()}”`, b.action, b.field || "any", b.pattern.trim(), b.weight ?? 3, nowIso(), nowIso());
  return { ok: true, id };
});
