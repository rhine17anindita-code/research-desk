import type { DB } from "../db";
import { activeChannelId } from "../channels";
import { extractEntities, stripHtml } from "../text";

/**
 * Statements radar: quotes by public figures found in the coverage, ranked by how
 * consequential or explosive they are. Local and free — headline/description text only.
 * Each statement links back to its story and outlet so it can be checked.
 */

export interface Statement {
  quote: string;
  speaker: string;
  verb: string;
  publisher: string | null;
  url: string;
  publishedAt: string | null;
  clusterId: string | null;
  headline: string;
  score: number;
  why: string[];
}

const VERBS: Record<string, number> = {
  threaten: 4, threatened: 4, threatens: 4, warn: 3, warned: 3, warns: 3, vow: 3, vowed: 3, vows: 3, accuse: 3, accused: 3, accuses: 3,
  admit: 4, admitted: 4, admits: 4, deny: 3, denied: 3, denies: 3, slam: 3, slammed: 3, slams: 3, blame: 3, blamed: 3, blames: 3,
  reveal: 3, revealed: 3, reveals: 3, confess: 4, confessed: 4, apologise: 3, apologised: 3, apologize: 3, apologized: 3, claim: 2, claimed: 2, claims: 2,
  insist: 2, insisted: 2, insists: 2, demand: 3, demanded: 3, demands: 3, call: 1, called: 1, calls: 1, urge: 2, urged: 2, urges: 2,
  say: 1, said: 1, says: 1, tell: 1, told: 1, tells: 1, declare: 2, declared: 2, declares: 2, announce: 2, announced: 2, announces: 2, attack: 3, attacked: 3,
};

const LOADED = /\b(war|kill|killed|death|dead|die|genocide|nuclear|bomb|illegal|corrupt\w*|lie|lies|liar|betray\w*|traitor|resign\w*|arrest\w*|ban|banned|sanction\w*|coup|terror\w*|crisis|collapse|revenge|destroy\w*|never|enemy|shame|disgrace|fraud|rigged|stolen|invade|invasion|crime|criminal|prison|jail|execute\w*|bankrupt\w*|threat|fire|fired|scandal|secret|cover-?up|conspiracy|regret|mistake|apolog\w*|racist|hate|extremist|weapon\w*|blood|famine|starv\w*)\b/gi;

const NOT_PEOPLE = new Set([
  "Reuters", "AP", "AFP", "BBC", "CNN", "Agence France-Presse", "Associated Press", "Al Jazeera", "Bloomberg", "Xinhua", "PTI", "ANI", "UNB", "BSS", "Dawn", "The Hindu",
  "Police", "Officials", "Sources", "Report", "Government", "Ministry", "Army", "Analysts", "Experts", "Witnesses", "Residents", "Critics", "Activists", "Statement",
  "He", "She", "They", "We", "It", "Her", "His", "Their", "Our", "I", "You", "This", "That", "US", "UK", "EU", "UN",
]);
const PRONOUN = /^(he|she|they|we|it|her|his|their|our|i|you|this|that|who|which)$/i;

interface ArtRow { title: string; summary: string | null; publisher: string | null; url: string; published_at: string | null; cluster_id: string | null }

function findQuotes(text: string): string[] {
  const out: string[] = [];
  const patterns = [/[“"]([^“”"]{25,280})[”"]/g, /(?:^|[\s(:])[‘']([^‘’']{25,280})[’'](?=[\s,.:;!?)]|$)/g];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const q = m[1].trim().replace(/[,]$/, "");
      if (q.split(/\s+/).length >= 6 && /^[\p{Lu}0-9]/u.test(q) && !out.includes(q)) out.push(q);
    }
  }
  return out;
}

/** Find who said it: a name immediately before/after a speech verb adjacent to the quote, or "X: '…'" headlines. */
const NAME = "\\p{Lu}[\\p{L}.'-]+(?:\\s+(?:bin|al|de|van|von)?\\s*\\p{Lu}[\\p{L}.'-]+){0,3}";
function speakerFor(text: string, quote: string): { speaker: string; verb: string } | null {
  const idx = text.indexOf(quote);
  const before = text.slice(Math.max(0, idx - 140), idx).replace(/[\s“"‘']+$/, " ");
  const after = text.slice(idx + quote.length).replace(/^[\s,.;”"’']+/, " ").slice(0, 120);
  const verbs = Object.keys(VERBS).join("|");
  const ok = (name: string | undefined) => !!name && !PRONOUN.test(name) && !NOT_PEOPLE.has(name) && name.length > 2;
  const strip = (r: { speaker: string; verb: string } | null) => {
    if (!r) return r;
    const parts = r.speaker.split(/\s+/);
    while (parts.length > 1 && /^(Minister|President|Prime|Chief|Foreign|Home|Finance|Defence|Defense|Secretary|General|Senator|Governor|Mayor|Judge|Justice|Speaker|Ambassador|Director|Chairman|Chair|CEO|Former|Ex|Deputy|Leader|Commander|Spokesperson|Spokesman|Dr|Mr|Mrs|Ms|Sir)$/.test(parts[0])) parts.shift();
    return { ...r, speaker: parts.join(" ") };
  };
  // …”, X said   |   …”, said X
  let m = after.match(new RegExp(`^\\s*[,.]?\\s*(${NAME})\\s+(${verbs})\\b`, "u"));
  if (m && ok(m[1])) return strip({ speaker: m[1], verb: m[2].toLowerCase() });
  m = after.match(new RegExp(`^\\s*[,.]?\\s*(${verbs})\\s+(${NAME})`, "u"));
  if (m && ok(m[2])) return strip({ speaker: m[2], verb: m[1].toLowerCase() });
  // X said/warned (that): “…”
  m = before.match(new RegExp(`(${NAME})\\s+(?:has\\s+|had\\s+)?(${verbs})(?:\\s+that|\\s+on\\s+\\p{L}+)?\\s*[,:]?\\s*$`, "u"));
  if (m && ok(m[1])) return strip({ speaker: m[1], verb: m[2].toLowerCase() });
  // Headline style  X: “…”
  m = before.match(new RegExp(`(${NAME})\\s*:\\s*$`, "u"));
  if (m && ok(m[1])) return strip({ speaker: m[1], verb: "says" });
  return null;
}

export function findStatements(db: DB, opts: { days?: number; limit?: number } = {}): Statement[] {
  const since = new Date(Date.now() - (opts.days ?? 5) * 86_400_000).toISOString();
  const rows = db
    .prepare(
      `SELECT a.title, a.summary, a.publisher, a.url, a.published_at, a.cluster_id FROM articles a
       JOIN channel_feeds cf ON cf.feed_id = a.feed_id AND cf.channel_id = ?
       WHERE COALESCE(a.published_at, a.fetched_at) >= ? ORDER BY COALESCE(a.published_at, a.fetched_at) DESC LIMIT 3000`,
    )
    .all(activeChannelId(db), since) as ArtRow[];

  // Prominence: how many articles mention each name this week.
  const mentions = new Map<string, number>();
  for (const r of rows) for (const e of extractEntities(`${r.title}. ${r.summary ?? ""}`, 8)) mentions.set(e, (mentions.get(e) ?? 0) + 1);
  const coverage = new Map((db.prepare("SELECT id, source_count FROM clusters WHERE last_updated_at >= ?").all(since) as { id: string; source_count: number }[]).map((c) => [c.id, c.source_count]));
  const headlines = new Map((db.prepare("SELECT id, headline FROM clusters WHERE last_updated_at >= ?").all(since) as { id: string; headline: string }[]).map((c) => [c.id, c.headline]));

  const seen = new Set<string>();
  const out: Statement[] = [];
  for (const r of rows) {
    const text = stripHtml(`${r.title}. ${r.summary ?? ""}`);
    for (const quote of findQuotes(text)) {
      const key = quote.toLowerCase().slice(0, 60);
      if (seen.has(key)) continue;
      const who = speakerFor(text, quote);
      if (!who || NOT_PEOPLE.has(who.speaker) || who.speaker.split(" ").length > 4) continue;
      seen.add(key);
      const why: string[] = [];
      let score = VERBS[who.verb] ?? 1;
      if ((VERBS[who.verb] ?? 0) >= 3) why.push(`${who.speaker} ${who.verb}`);
      const loaded = [...new Set((quote.match(LOADED) ?? []).map((w) => w.toLowerCase()))];
      if (loaded.length) { score += Math.min(4, loaded.length * 1.5); why.push(`loaded words: ${loaded.slice(0, 3).join(", ")}`); }
      const fame = [...mentions.entries()].filter(([e]) => e.includes(who.speaker) || who.speaker.includes(e)).reduce((m, [, n]) => Math.max(m, n), 0);
      if (fame >= 3) { score += Math.min(4, Math.log2(fame)); why.push(`${who.speaker} is in ${fame} articles this week`); }
      const cov = r.cluster_id ? coverage.get(r.cluster_id) ?? 1 : 1;
      if (cov >= 3) { score += Math.min(3, Math.log2(cov)); why.push(`${cov} outlets covering the story`); }
      if (/\?|!/.test(quote)) score += 0.5;
      if (score < 3) continue;
      out.push({
        quote, speaker: who.speaker, verb: who.verb, publisher: r.publisher, url: r.url, publishedAt: r.published_at, clusterId: r.cluster_id,
        headline: (r.cluster_id && headlines.get(r.cluster_id)) || r.title, score: Math.round(score * 10) / 10, why,
      });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 30);
}
