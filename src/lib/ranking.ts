import type { DB } from "./db";
import { parseJson } from "./db";
import { detectSignals, type SignalMatch } from "./signals";
import { getSetting } from "./repo/settings";
import { nowIso } from "./ids";
import { uniqueTokens } from "./text";
import { recordTaste } from "./ideation/repo";

/**
 * Transparent, rule-based ranking. No model calls. Every score comes with a
 * breakdown the UI shows under "Why this story", so the user can see and correct
 * what the system thinks they care about.
 */

export interface SignalPref { id: string; label: string; cues: string[]; weight: number; learned: number; enabled: number }
export interface RulePref { id: string; name: string; action: "boost" | "bury" | "hide"; field: "any" | "title" | "publisher" | "region"; pattern: string; weight: number; enabled: number }

export interface RankInput {
  headline: string;
  text: string; // headline + summary + member headlines
  publishers: string[];
  regions: string[];
  sourceCount: number;
  articleCount: number;
  lastUpdated: number;
  avgFeedPriority: number;
  tokens: string[];
  rating: number;
  aiSignals?: { id: string; strength: number }[];
}

export interface RankPrefs {
  signals: SignalPref[];
  rules: RulePref[];
  termWeights: Map<string, number>;
  regionWeights: Record<string, number>;
  now: number;
}

export interface ScoreBreakdown {
  total: number;
  hidden: boolean;
  parts: { label: string; value: number }[];
  signals: SignalMatch[];
  ruleHits: string[];
}

function ruleMatches(rule: RulePref, input: RankInput): boolean {
  let re: RegExp;
  try {
    re = new RegExp(rule.pattern, "i");
  } catch {
    re = new RegExp(rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }
  switch (rule.field) {
    case "title": return re.test(input.headline);
    case "publisher": return input.publishers.some((p) => re.test(p));
    case "region": return input.regions.some((r) => re.test(r));
    default: return re.test(input.text) || input.publishers.some((p) => re.test(p));
  }
}

export function scoreCluster(input: RankInput, prefs: RankPrefs): ScoreBreakdown {
  const parts: { label: string; value: number }[] = [];
  const enabledSignals = prefs.signals.filter((s) => s.enabled);
  const signals = detectSignals(input.text, enabledSignals);

  // Editorial signals: diminishing returns on repeated cue hits.
  let signalScore = 0;
  for (const m of signals) {
    const s = enabledSignals.find((x) => x.id === m.signalId)!;
    const w = Math.max(0, s.weight + s.learned);
    const v = w * (1 + Math.log2(m.matches.length)) * 1.2;
    signalScore += v;
  }
  if (input.aiSignals?.length) {
    for (const a of input.aiSignals) {
      const s = enabledSignals.find((x) => x.id === a.id);
      if (!s) continue;
      signalScore += Math.max(0, s.weight + s.learned) * a.strength * 1.5;
    }
  }
  if (signalScore) parts.push({ label: "Editorial signals", value: signalScore });

  // Breadth of coverage.
  const coverage = Math.log2(1 + input.sourceCount) * 1.6;
  parts.push({ label: `Coverage (${input.sourceCount} source${input.sourceCount === 1 ? "" : "s"})`, value: coverage });

  // Recency: half-life of 30 hours.
  const ageH = Math.max(0, (prefs.now - input.lastUpdated) / 3_600_000);
  const recency = 3 * Math.pow(0.5, ageH / 30);
  parts.push({ label: "Recency", value: recency });

  // Source priority (user-set per feed, default 1).
  const pri = (input.avgFeedPriority - 1) * 2;
  if (pri) parts.push({ label: "Source priority", value: pri });

  // Regional preference.
  let region = 0;
  for (const r of input.regions) region += prefs.regionWeights[r] ?? 0;
  if (region) parts.push({ label: "Region preference", value: region });

  // Learned vocabulary affinity from feedback, capped so it can't dominate.
  let affinity = 0;
  for (const t of input.tokens) affinity += prefs.termWeights.get(t) ?? 0;
  affinity = Math.max(-4, Math.min(4, affinity));
  if (affinity) parts.push({ label: "Learned from your feedback", value: affinity });

  if (input.rating) parts.push({ label: input.rating > 0 ? "You marked interesting" : "You marked not interesting", value: input.rating * 3 });

  let hidden = false;
  const ruleHits: string[] = [];
  for (const rule of prefs.rules.filter((r) => r.enabled)) {
    if (!ruleMatches(rule, input)) continue;
    ruleHits.push(rule.name);
    if (rule.action === "hide") hidden = true;
    else parts.push({ label: `Rule: ${rule.name}`, value: rule.action === "boost" ? rule.weight : -rule.weight });
  }

  const total = parts.reduce((s, p) => s + p.value, 0);
  return { total: Math.round(total * 100) / 100, hidden, parts, signals, ruleHits };
}

export function loadPrefs(db: DB): RankPrefs {
  const signals = (db.prepare("SELECT id, label, cues, weight, learned, enabled FROM signals").all() as (Omit<SignalPref, "cues"> & { cues: string })[]).map(
    (s) => ({ ...s, cues: parseJson<string[]>(s.cues, []) }),
  );
  const rules = db.prepare("SELECT id, name, action, field, pattern, weight, enabled FROM rules").all() as RulePref[];
  const termWeights = new Map(
    (db.prepare("SELECT term, weight FROM term_weights WHERE ABS(weight) > 0.01").all() as { term: string; weight: number }[]).map((r) => [r.term, r.weight]),
  );
  return { signals, rules, termWeights, regionWeights: getSetting(db, "discover.region_weights"), now: Date.now() };
}

export interface RankedCluster {
  id: string;
  headline: string;
  summary: string | null;
  firstSeenAt: string;
  lastUpdatedAt: string;
  articleCount: number;
  sourceCount: number;
  publishers: string[];
  regions: string[];
  state: string;
  rating: number;
  isSample: boolean;
  questionCount: number;
  topQuestion: string | null;
  inProjects: number;
  score: ScoreBreakdown;
}

export interface FeedQuery {
  view?: "ranked" | "latest" | "saved" | "dismissed";
  signal?: string;
  region?: string;
  publisher?: string;
  q?: string;
  minSources?: number;
  hours?: number;
  limit?: number;
}

interface ClusterRow {
  id: string; headline: string; summary: string | null; first_seen_at: string; last_updated_at: string; article_count: number;
  source_count: number; tokens: string; regions: string; state: string; rating: number; is_sample: number; ai_assessment: string | null;
}

export function rankFeed(db: DB, query: FeedQuery = {}): { items: RankedCluster[]; totalCandidates: number } {
  const prefs = loadPrefs(db);
  const hours = query.hours ?? getSetting(db, "discover.window_hours");
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const view = query.view ?? "ranked";

  const where: string[] = [];
  const params: unknown[] = [];
  if (view === "saved") where.push("c.state = 'saved'");
  else if (view === "dismissed") where.push("c.state = 'dismissed'");
  else {
    where.push("c.state != 'dismissed'", "c.last_updated_at >= ?");
    params.push(since);
  }
  if (query.minSources) { where.push("c.source_count >= ?"); params.push(query.minSources); }
  if (query.region) { where.push("c.regions LIKE ?"); params.push(`%"${query.region}"%`); }
  if (query.q) {
    where.push("c.id IN (SELECT ref_id FROM search_index WHERE kind = 'cluster' AND search_index MATCH ?)");
    const terms = (query.q.match(/[\p{L}\p{N}]+/gu) ?? []).map((t) => `"${t}"*`).join(" AND ");
    params.push(terms || '""');
  }
  const rows = db.prepare(`SELECT c.* FROM clusters c WHERE ${where.join(" AND ")} ORDER BY c.last_updated_at DESC LIMIT 1500`).all(...params) as ClusterRow[];

  const memberStmt = db.prepare(
    `SELECT a.title, a.summary, a.publisher, COALESCE(f.priority, 1) AS priority FROM articles a LEFT JOIN feeds f ON f.id = a.feed_id WHERE a.cluster_id = ?`,
  );
  const qStmt = db.prepare("SELECT COUNT(*) AS n, (SELECT text FROM questions WHERE cluster_id = ? AND archived = 0 ORDER BY priority ASC, position ASC LIMIT 1) AS top FROM questions WHERE cluster_id = ? AND archived = 0");
  const pStmt = db.prepare("SELECT COUNT(*) AS n FROM project_items WHERE item_type = 'cluster' AND item_id = ?");

  const scored: RankedCluster[] = [];
  for (const r of rows) {
    const members = memberStmt.all(r.id) as { title: string; summary: string | null; publisher: string | null; priority: number }[];
    const publishers = [...new Set(members.map((m) => m.publisher ?? "Unknown"))];
    if (query.publisher && !publishers.includes(query.publisher)) continue;
    const tok = parseJson<{ t: string[]; a: string[] }>(r.tokens, { t: [], a: [] });
    const assessment = parseJson<{ signals?: { id: string; strength: number }[] } | null>(r.ai_assessment, null);
    const text = [r.headline, r.summary ?? "", ...members.map((m) => `${m.title}. ${m.summary ?? ""}`)].join(" \n ");
    const score = scoreCluster(
      {
        headline: r.headline,
        text,
        publishers,
        regions: parseJson<string[]>(r.regions, []),
        sourceCount: r.source_count,
        articleCount: r.article_count,
        lastUpdated: new Date(r.last_updated_at).getTime(),
        avgFeedPriority: members.length ? members.reduce((s, m) => s + m.priority, 0) / members.length : 1,
        tokens: tok.t.length ? tok.t : uniqueTokens(r.headline),
        rating: r.rating,
        aiSignals: assessment?.signals,
      },
      prefs,
    );
    if (score.hidden && view === "ranked") continue;
    if (query.signal && !score.signals.some((s) => s.signalId === query.signal) && !assessment?.signals?.some((s) => s.id === query.signal)) continue;
    const qs = qStmt.get(r.id, r.id) as { n: number; top: string | null };
    scored.push({
      id: r.id,
      headline: r.headline,
      summary: r.summary,
      firstSeenAt: r.first_seen_at,
      lastUpdatedAt: r.last_updated_at,
      articleCount: r.article_count,
      sourceCount: r.source_count,
      publishers,
      regions: parseJson<string[]>(r.regions, []),
      state: r.state,
      rating: r.rating,
      isSample: !!r.is_sample,
      questionCount: qs.n,
      topQuestion: qs.top,
      inProjects: (pStmt.get(r.id) as { n: number }).n,
      score,
    });
  }
  if (view === "latest") scored.sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt));
  else scored.sort((a, b) => b.score.total - a.score.total);
  return { items: scored.slice(0, query.limit ?? 60), totalCandidates: scored.length };
}

/** Feedback updates learned signal weights and vocabulary affinity. All local arithmetic. */
export function recordFeedback(
  db: DB,
  clusterId: string,
  kind: "interesting" | "uninteresting" | "save" | "dismiss" | "restore" | "unsave" | "clear",
  reasons: string[] = [],
  note?: string,
): void {
  const c = db.prepare("SELECT id, headline, summary, tokens, rating, state FROM clusters WHERE id = ?").get(clusterId) as
    | { id: string; headline: string; summary: string | null; tokens: string; rating: number; state: string }
    | undefined;
  if (!c) throw new Error("Story not found");
  const now = nowIso();
  const tok = parseJson<{ t: string[] }>(c.tokens, { t: [] }).t.slice(0, 20);
  const prefs = loadPrefs(db);
  const detected = detectSignals(`${c.headline} ${c.summary ?? ""}`, prefs.signals).map((m) => m.signalId);

  const bumpTerms = (delta: number) => {
    const st = db.prepare(
      "INSERT INTO term_weights (term, weight, updated_at) VALUES (?, ?, ?) ON CONFLICT(term) DO UPDATE SET weight = MAX(-1.5, MIN(1.5, weight + excluded.weight)), updated_at = excluded.updated_at",
    );
    for (const t of tok) st.run(t, delta, now);
  };
  const bumpSignals = (ids: string[], delta: number) => {
    const st = db.prepare("UPDATE signals SET learned = MAX(-1, MIN(2, learned + ?)), updated_at = ? WHERE id = ?");
    for (const id of ids) st.run(delta, now, id);
  };

  db.transaction(() => {
    db.prepare("INSERT INTO feedback (id, cluster_id, kind, reasons, note, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, clusterId, kind, JSON.stringify(reasons), note ?? null, now,
    );
    switch (kind) {
      case "interesting":
        recordTaste(db, { kind: "story-like", objectType: "cluster", objectId: clusterId, tags: tok, reason: reasons.join(",") || null });
        db.prepare("UPDATE clusters SET rating = 1, updated_at = ? WHERE id = ?").run(now, clusterId);
        bumpTerms(0.15);
        bumpSignals(reasons.length ? reasons : detected, reasons.length ? 0.25 : 0.08);
        break;
      case "uninteresting":
        recordTaste(db, { kind: "story-dislike", objectType: "cluster", objectId: clusterId, tags: tok });
        db.prepare("UPDATE clusters SET rating = -1, updated_at = ? WHERE id = ?").run(now, clusterId);
        bumpTerms(-0.15);
        bumpSignals(detected, -0.05);
        break;
      case "clear":
        db.prepare("UPDATE clusters SET rating = 0, updated_at = ? WHERE id = ?").run(now, clusterId);
        break;
      case "save":
        db.prepare("UPDATE clusters SET state = 'saved', updated_at = ? WHERE id = ?").run(now, clusterId);
        bumpTerms(0.08);
        bumpSignals(reasons.length ? reasons : detected, reasons.length ? 0.2 : 0.04);
        break;
      case "unsave":
      case "restore":
        db.prepare("UPDATE clusters SET state = 'new', updated_at = ? WHERE id = ?").run(now, clusterId);
        break;
      case "dismiss":
        db.prepare("UPDATE clusters SET state = 'dismissed', updated_at = ? WHERE id = ?").run(now, clusterId);
        bumpTerms(-0.04);
        break;
    }
  })();
}
