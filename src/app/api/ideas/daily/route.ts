import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { activeChannel, updateChannel } from "@/lib/channels";
import { generateIdeasV2 } from "@/lib/ideation/engine";
import { nowIso } from "@/lib/ids";

/**
 * Opt-in fresh batch: runs at most every 12 hours per channel, only if the
 * channel has "start each day with fresh ideas" switched on. Budgets still apply.
 */
export const maxDuration = 180;

export const POST = route(async () => {
  const db = getDb();
  const ch = activeChannel(db);
  if (!ch.dailyIdeas) return { ok: true, skipped: "Daily ideas are off for this channel" };
  if (ch.lastDailyAt && Date.now() - Date.parse(ch.lastDailyAt) < 12 * 3_600_000) return { ok: true, skipped: "Fresh batch made in the last 12 hours" };
  updateChannel(db, ch.id, { lastDailyAt: nowIso() }); // claim first so parallel visits don't double-run
  const r = await generateIdeasV2(db, { count: 8 });
  if ("estimate" in r) return { ok: true };
  if (!r.ok) {
    updateChannel(db, ch.id, { lastDailyAt: ch.lastDailyAt });
    return { ok: false, message: r.message };
  }
  return { ok: true, created: r.data.ideas.length };
});
