import { createHash } from "node:crypto";

const STOPWORDS = new Set(
  `a about above after again against all also am an and any are as at be because been before being below between both
  but by can could did do does doing down during each few for from further had has have having he her here hers herself
  him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or
  other our ours ourselves out over own same she should so some such than that the their theirs them themselves then
  there these they this those through to too under until up very was we were what when where which while who whom why
  will with would you your yours yourself yourselves says said say new news live update updates latest report reports
  amid over after year years day days week weeks month months us u.s via get gets got make makes made one two three first
  last may might must shall like just still back take takes taken among across around against within without per could`.split(/\s+/),
);

/** Strip tags, decode common entities, collapse whitespace. */
export function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(asText).join(" ");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return asText(o._ ?? o["#"] ?? o.$t ?? o.value ?? "");
  }
  return "";
}

export function stripHtml(raw: unknown): string {
  const input = asText(raw);
  if (!input) return "";
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#8217;|&rsquo;/g, "'")
    .replace(/&#8216;|&lsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const sp = cut.lastIndexOf(" ");
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut) + "…";
}

/** Lowercased content tokens with light suffix stemming. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9][a-z0-9'-]*[a-z0-9]|[a-z0-9]/g) ?? [])
    .map((t) => t.replace(/'s$/, "").replace(/'/g, ""))
    .filter((t) => t.length > 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t))
    .map(stem);
}

function stem(t: string): string {
  if (t.length > 5 && t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.length > 4 && t.endsWith("es") && /(ch|sh|x|s|z)es$/.test(t)) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") && !t.endsWith("us") && !t.endsWith("is")) return t.slice(0, -1);
  return t;
}

export function uniqueTokens(text: string): string[] {
  return [...new Set(tokenize(text))];
}

export function jaccard(a: Iterable<string>, b: Iterable<string>): number {
  const A = a instanceof Set ? a : new Set(a);
  const B = b instanceof Set ? b : new Set(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Fraction of the smaller set contained in the larger (robust to long vs short headlines). */
export function overlapCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / Math.min(a.size, b.size);
}

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_cid|mc_eid|ref$|ref_|cmpid|ito$|at_medium|at_campaign|ns_|smid|partner|CMP$|traffic_source)/i;

/** Canonical form of an article URL used for exact deduplication. */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^amp\./, "");
    for (const key of [...u.searchParams.keys()]) if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    u.searchParams.sort();
    let p = u.pathname.replace(/\/amp\/?$/, "/").replace(/\/+$/, "");
    if (p === "") p = "/";
    u.pathname = p;
    u.protocol = "https:";
    return u.toString().replace(/\?$/, "");
  } catch {
    return raw.trim();
  }
}

/** Hash of a normalised headline, for catching the same article under different URLs. */
export function titleHash(title: string): string {
  const norm = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return createHash("sha1").update(norm).digest("hex").slice(0, 16);
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

const ENTITY_STOP = new Set(
  "The A An In On At For From With By Of And But Or As To After Before Over Under Why How What When Where Who Which This That These Those It Its Is Are Was Were Be New Live Watch Opinion Analysis Explainer Breaking Update Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August September October November December Mr Mrs Ms Dr He She They We I Our Their Here There".split(
    " ",
  ),
);

/**
 * Cheap entity candidates: runs of capitalised words (and acronyms) that are not
 * just sentence starters. Good enough to connect stories sharing "Federal Reserve"
 * or "Rohingya" without an NLP model.
 */
export function extractEntities(text: string, max = 12): string[] {
  const counts = new Map<string, number>();
  const sentences = text.split(/(?<=[.!?:;"“”])\s+|\s[–—-]\s/);
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/);
    let run: string[] = [];
    const flush = (startIdx: number) => {
      if (run.length) {
        const phrase = run.join(" ").replace(/[’']s$/, "");
        const single = run.length === 1;
        const isAcronym = /^[A-Z]{2,6}$/.test(phrase);
        // single capitalised word at sentence start is unreliable
        const longEnough = phrase.length > 2 || /^\p{Lu}[\p{L}]$/u.test(phrase) || isAcronym;
        const adjective = /-(based|led|backed|born|owned|made|style)$/i.test(phrase);
        if (!(single && startIdx === 0 && !isAcronym) && !ENTITY_STOP.has(phrase) && longEnough && !adjective) {
          counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
        }
      }
      run = [];
    };
    let runStart = 0;
    words.forEach((raw, i) => {
      const w = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}’']+$/gu, "");
      const cap = /^(\p{Lu}[\p{L}’'-]*|[A-Z]{2,6})$/u.test(w) && !ENTITY_STOP.has(w);
      const connector = run.length > 0 && /^(of|de|al|bin|von|van|for)$/.test(w) && i + 1 < words.length;
      if (cap || connector) {
        if (run.length === 0) runStart = i;
        run.push(w);
      } else {
        while (run.length && /^(of|de|al|bin|von|van|for)$/.test(run[run.length - 1])) run.pop();
        flush(runStart);
      }
      if (/[,;:]$/.test(raw)) {
        while (run.length && /^(of|de|al|bin|von|van|for)$/.test(run[run.length - 1])) run.pop();
        flush(runStart);
      }
    });
    while (run.length && /^(of|de|al|bin|von|van|for)$/.test(run[run.length - 1])) run.pop();
    flush(runStart);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([e]) => e)
    .slice(0, max);
}

/** Build a compact keyword query (for external search APIs) from free text. */
export function keywordQuery(text: string, maxTerms = 6, extra: string[] = []): string {
  const ents = extractEntities(text, 3);
  const toks = [...new Set((text.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []).filter((t) => !STOPWORDS.has(t)))];
  const words: string[] = [];
  for (const e of [...extra, ...ents]) {
    if (words.join(" ").length >= 80) break;
    if (!words.some((w) => w.toLowerCase() === e.toLowerCase())) words.push(e);
  }
  for (const t of toks) {
    if (words.length >= maxTerms) break;
    if (!words.some((w) => w.toLowerCase().includes(t))) words.push(t);
  }
  return words.slice(0, maxTerms).join(" ");
}

/** Escape free text for an FTS5 MATCH expression: each term quoted, OR-joined when `any`. */
export function ftsQuery(input: string, mode: "all" | "any" = "all"): string | null {
  const terms = (input.match(/[\p{L}\p{N}]+/gu) ?? []).filter((t) => t.length > 1).slice(0, 12);
  if (!terms.length) return null;
  return terms.map((t) => `"${t.replace(/"/g, "")}"*`).join(mode === "all" ? " AND " : " OR ");
}
