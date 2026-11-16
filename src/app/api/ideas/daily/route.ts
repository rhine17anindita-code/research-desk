import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { activeChannel, updateChannel } from "@/lib/channels";
import { generateIdeasV2 } from "@/lib/ideation/engine";
import { nowIso } from "@/lib/ids";

/**
 * Opt-in daily batch: runs at most once per calendar day per channel, only if the
 * channel has "start each day with fresh ideas" switched on. Budgets still apply.
 */
export const maxDuration = 180;

export const POST = route(async () => {
  const db = getDb();
  const ch = activeChannel(db);
  const today = new Date().toISOString().slice(0, 10);
  if (!ch.dailyIdeas) return { ok: true, skipped: "Daily ideas are off for this channel" };
  if (ch.lastDailyAt?.slice(0, 10) === today) return { ok: true, skipped: "Already generated today" };
  updateChannel(db, ch.id, { lastDailyAt: nowIso() }); // claim first so parallel visits don't double-run
  const r = await generateIdeasV2(db, { count: 8 });
  if ("estimate" in r) return { ok: true };
  if (!r.ok) {
    updateChannel(db, ch.id, { lastDailyAt: ch.lastDailyAt });
    return { ok: false, message: r.message };
  }
  return { ok: true, created: r.data.ideas.length };
});
