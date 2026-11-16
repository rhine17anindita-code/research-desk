import type { DB } from "../db";
import { parseJson } from "../db";
import { loadPrefs } from "../ranking";
import { detectSignals } from "../signals";
import { uniqueTokens } from "../text";
import { activeChannel, CHANNEL_CLUSTER_SQL } from "../channels";
import { listInspirations, tasteStats } from "./repo";

/**
 * Finds stories with untold-angle potential — no AI, no network.
 * A story scores when coverage is thin or one-sided relative to its signals:
 *  - covered only by regional / specialist outlets (international press missed it)
 *  - few outlets but strong editorial signals
 *  - contradictions, money/influence, historical hooks
 *  - open research questions the user already marked (needs investigation, contested)
 *  - overlap with the user's inspirations and learned taste
 * Each result explains its score so the user (and the AI) can see why.
 */

export interface Opportunity {
  clusterId: string;
  headline: string;
  summary: string | null;
  publishers: string[];
  sourceCount: number;
  lastUpdatedAt: string;
  score: number;
  reasons: string[];
  signals: string[];
  openQuestions: { id: string; text: string; state: string }[];
}

const INTERNATIONAL = new Set(["international"]);

export function findOpportunities(db: DB, opts: { days?: number; limit?: number; excludeUsed?: boolean } = {}): Opportunity[] {
  const since = new Date(Date.now() - (opts.days ?? 7) * 86_400_000).toISOString();
  const prefs = loadPrefs(db);
  const enabledSignals = prefs.signals.filter((s) => s.enabled);
  const labels = Object.fromEntries(prefs.signals.map((s) => [s.id, s.label]));

  const channel = activeChannel(db);
  // "Missed by international outlets" only means something for channels that follow them.
  const channelHasIntl = !!db.prepare("SELECT 1 FROM channel_feeds cf JOIN feeds f ON f.id = cf.feed_id WHERE cf.channel_id = ? AND f.category = 'international' LIMIT 1").get(channel.id);
  const profileTerms = new Set(uniqueTokens(`${channel.profile} ${channel.description ?? ""}`));
  const inspirationTerms = new Set(
    listInspirations(db, 50).flatMap((i) => uniqueTokens(`${i.title ?? ""} ${i.note ?? ""} ${i.analysis?.topic ?? ""}`)),
  );
  const taste = tasteStats(db);
  const likedTerms = new Map(taste.likedTerms.map((t) => [t.term, t.n]));
  const passedTerms = new Map(taste.passedTerms.map((t) => [t.term, t.n]));

  const clusters = db
    .prepare(
      `SELECT c.id, c.headline, c.summary, c.source_count, c.last_updated_at, c.tokens, c.entities, c.rating
       FROM clusters c WHERE c.last_updated_at >= ? AND c.state != 'dismissed' AND c.is_sample = 0 AND ${CHANNEL_CLUSTER_SQL} ORDER BY c.last_updated_at DESC LIMIT 2500`,
    )
    .all(since, channel.id) as { id: string; headline: string; summary: string | null; source_count: number; last_updated_at: string; tokens: string; entities: string; rating: number }[];

  const arts = db.prepare(
    `SELECT a.title, a.summary, a.publisher, COALESCE(f.category, 'topic') AS category FROM articles a LEFT JOIN feeds f ON f.id = a.feed_id WHERE a.cluster_id = ?`,
  );
  const openQ = db.prepare(
    "SELECT id, text, answer_state FROM questions WHERE cluster_id = ? AND archived = 0 AND answer_state IN ('needs-investigation', 'contested', 'open', 'partial')",
  );
  const used = opts.excludeUsed === false ? new Set<string>() : new Set(
    (db.prepare("SELECT backing FROM ideas WHERE created_at >= ? AND channel_id = ?").all(since, channel.id) as { backing: string }[]).flatMap((r) => parseJson<{ clusters: string[] }>(r.backing, { clusters: [] }).clusters),
  );

  const out: Opportunity[] = [];
  for (const c of clusters) {
    if (used.has(c.id)) continue;
    const members = arts.all(c.id) as { title: string; summary: string | null; publisher: string | null; category: string }[];
    const text = [c.headline, c.summary ?? "", ...members.map((m) => `${m.title} ${m.summary ?? ""}`)].join(" ");
    const signals = detectSignals(text, enabledSignals).map((s) => s.signalId);
    const reasons: string[] = [];
    let score = 0;

    const intl = !channelHasIntl || members.some((m) => INTERNATIONAL.has(m.category));
    const publishers = [...new Set(members.map((m) => m.publisher ?? "Unknown"))];
    if (!intl && publishers.length >= 2) {
      score += 3.5;
      reasons.push(`${publishers.length} regional/specialist outlets cover it, but no international outlet has picked it up`);
    } else if (publishers.length === 1 && signals.length >= 2) {
      score += 1.5;
      reasons.push(`Only ${publishers[0]} has this so far — possibly overlooked`);
    } else if (c.source_count <= 2 && signals.length >= 3) {
      score += 1.5;
      reasons.push(`Thin coverage for a story with ${signals.length} editorial signals`);
    }
    if (signals.includes("contradiction")) { score += 2; reasons.push("Accounts conflict — room to establish what is true"); }
    if (signals.includes("power-incentives")) { score += 1.5; reasons.push("Money, influence or incentives involved — who benefits?"); }
    if (signals.includes("historical-context")) { score += 1; reasons.push("Historical hook — a backstory worth telling"); }
    if (signals.includes("unclear-meaning")) { score += 1; reasons.push("Announcement whose real meaning is unexplained"); }
    if (signals.includes("structural-problem")) { score += 1; }
    const qs = (openQ.all(c.id) as { id: string; text: string; answer_state: string }[]).map((q) => ({ id: q.id, text: q.text, state: q.answer_state }));
    if (qs.length) {
      score += Math.min(4, qs.length * 1.5);
      reasons.push(`${qs.length} of your questions are still open or contested`);
    }
    const toks = parseJson<{ t: string[] }>(c.tokens, { t: [] }).t;
    const prof = new Set([...toks, ...parseJson<string[]>(c.entities, []).map((e) => e.toLowerCase())].filter((t) => profileTerms.has(t)));
    if (prof.size >= 1) { score += Math.min(3, prof.size * 1.5); reasons.push(`Matches your focus (${[...prof].slice(0, 3).join(", ")})`); }
    const insp = toks.filter((t) => inspirationTerms.has(t)).length;
    if (insp >= 2) { score += 2; reasons.push("Matches themes in your inspiration inbox"); }
    let affinity = 0;
    for (const t of toks) affinity += (likedTerms.get(t) ?? 0) * 0.3 - (passedTerms.get(t) ?? 0) * 0.3;
    affinity += c.rating * 2;
    if (affinity > 0.9) reasons.push("Close to topics you have saved or developed before");
    score += Math.max(-3, Math.min(3, affinity));
    // Fresher is better for timely formats; mild decay.
    const ageH = (Date.now() - new Date(c.last_updated_at).getTime()) / 3_600_000;
    score += 1.5 * Math.pow(0.5, ageH / 48);

    if (score < 3 || !reasons.length) continue;
    out.push({
      clusterId: c.id, headline: c.headline, summary: c.summary, publishers, sourceCount: c.source_count, lastUpdatedAt: c.last_updated_at,
      score: Math.round(score * 10) / 10, reasons, signals: signals.map((s) => labels[s] ?? s), openQuestions: qs,
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 30);
}
