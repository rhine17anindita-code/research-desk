import type { DB } from "../db";
import { rankFeed } from "../ranking";
import { findOpportunities } from "./opportunities";
import { activeChannel } from "../channels";
import { getStory } from "../repo/stories";
import { familiarityDays, isOldNews } from "./familiarity";
import { SPORT } from "./statements";
import { jaccard, uniqueTokens } from "../text";

/** The best stories to build a piece on right now: the biggest ones for this channel plus the most promising untold ones. */
export interface BuildStory {
  id: string;
  headline: string;
  summary: string | null;
  image: string | null;
  sourceCount: number;
  kind: "big" | "untold";
  why: string;
}

export function storiesToBuild(db: DB, limit = 6): BuildStory[] {
  const ch = activeChannel(db);
  const sportsChannel = SPORT.test(`${ch.name} ${ch.description ?? ""} ${ch.profile}`);
  // Skip sport (unless it's a sports channel) and stories the audience has heard about for weeks.
  // The creator's own "this bores me" examples: skip stories that look like them.
  const bad = ch.badExamples.split("\n").map((l) => new Set(uniqueTokens(l.replace(/\(.*?\)/g, "")))).filter((t) => t.size >= 3);
  const ok = (id: string, headline: string) => {
    if (!sportsChannel && SPORT.test(headline)) return false;
    const toks = new Set(uniqueTokens(headline));
    if (bad.some((b) => jaccard(b, toks) >= 0.25)) return false;
    const st = getStory(db, id);
    return !(st && isOldNews(familiarityDays(db, st.entities)));
  };
  const big = rankFeed(db, { hours: 36, minSources: 2, limit: 30 }).items
    .filter((b) => ok(b.id, b.headline))
    .map((b) => ({ b, focus: !!b.score.parts.find((p) => p.label === "Your focus") }))
    .filter((x) => x.focus || x.b.sourceCount >= 8) // off-focus stories only when they're genuinely huge
    .sort((x, y) => Number(y.focus) - Number(x.focus) || y.b.score.total - x.b.score.total);
  const untold = findOpportunities(db, { limit: 15 }).filter((u) => ok(u.clusterId, u.headline) && !u.reasons.some((r) => r.startsWith("Already familiar")));

  const out = new Map<string, BuildStory>();
  // Interleave: big, untold, big, untold… so both kinds are always visible.
  for (let i = 0; out.size < limit && (i < big.length || i < untold.length); i++) {
    const x = big[i];
    if (x && !out.has(x.b.id)) {
      out.set(x.b.id, {
        id: x.b.id, headline: x.b.headline, summary: x.b.summary, image: x.b.image, sourceCount: x.b.sourceCount, kind: "big",
        why: `${x.b.sourceCount} outlets on it${x.focus ? " · matches your focus" : ""} — needs the angle nobody else has`,
      });
    }
    const u = untold[i];
    if (u && out.size < limit && !out.has(u.clusterId)) {
      out.set(u.clusterId, { id: u.clusterId, headline: u.headline, summary: u.summary, image: null, sourceCount: u.publishers.length, kind: "untold", why: u.reasons[0] ?? "Big potential, little coverage" });
    }
  }
  return [...out.values()];
}
