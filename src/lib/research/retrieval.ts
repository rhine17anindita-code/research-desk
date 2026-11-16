import type { DB } from "../db";
import { getSetting } from "../repo/settings";
import { linkQuestionSource, upsertSource, sourceForArticle, type SourceInput } from "../repo/sources";
import type { Source } from "../types";
import { ftsQuery, stripHtml, truncate } from "../text";
import { USER_AGENT } from "../ingest/rss";

/**
 * Level 2 "Source exploration": targeted searches against free, legitimate indexes.
 * None of this calls a language model. Each provider returns only metadata the
 * index actually holds; nothing is filled in or guessed. Failures are reported per
 * provider instead of failing the whole search.
 */

export type ProviderId = "local" | "openalex" | "crossref" | "wikipedia" | "gdelt";

export interface ProviderOutcome {
  provider: ProviderId;
  query: string;
  found: number;
  error?: string;
}

type Fetcher = (url: string) => Promise<unknown>;

let fetcherOverride: Fetcher | null = null;
export function setRetrievalFetcherForTesting(f: Fetcher | null) {
  fetcherOverride = f;
}

async function getJson(url: string): Promise<unknown> {
  if (fetcherOverride) return fetcherOverride(url);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Response was not JSON");
  }
}

function invertedAbstract(inv: Record<string, number[]> | null | undefined): string | null {
  if (!inv) return null;
  const words: string[] = [];
  for (const [w, positions] of Object.entries(inv)) for (const p of positions) words[p] = w;
  const s = words.filter(Boolean).join(" ");
  return s ? truncate(s, 1500) : null;
}

export async function searchOpenAlex(query: string, limit = 5): Promise<SourceInput[]> {
  const mailto = process.env.OPENALEX_MAILTO?.trim();
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=${limit}&select=id,doi,title,display_name,publication_date,authorships,primary_location,abstract_inverted_index,type${mailto ? `&mailto=${encodeURIComponent(mailto)}` : ""}`;
  const json = (await getJson(url)) as { results?: Record<string, unknown>[] };
  return (json.results ?? [])
    .map((w) => {
      const loc = w.primary_location as { landing_page_url?: string; source?: { display_name?: string } } | null;
      const authors = ((w.authorships as { author?: { display_name?: string } }[]) ?? []).map((a) => a.author?.display_name).filter(Boolean).slice(0, 6);
      const doi = (w.doi as string | null)?.replace(/^https?:\/\/doi\.org\//, "") ?? null;
      const type = String(w.type ?? "");
      const title = stripHtml(String(w.title ?? w.display_name ?? ""));
      return {
        kind: (type === "report" ? "report" : type === "dataset" ? "statistics" : "paper") as SourceInput["kind"],
        title,
        authors: authors.length ? authors.join(", ") + (((w.authorships as unknown[]) ?? []).length > 6 ? " et al." : "") : null,
        publisher: loc?.source?.display_name ?? null,
        publishedAt: (w.publication_date as string) ?? null,
        url: doi ? `https://doi.org/${doi}` : loc?.landing_page_url ?? (w.id as string),
        doi,
        excerpt: invertedAbstract(w.abstract_inverted_index as Record<string, number[]>),
        provider: "openalex",
      };
    })
    .filter((s) => s.title);
}

export async function searchCrossref(query: string, limit = 5): Promise<SourceInput[]> {
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}&select=DOI,title,author,publisher,issued,type,abstract,URL,container-title`;
  const json = (await getJson(url)) as { message?: { items?: Record<string, unknown>[] } };
  return (json.message?.items ?? [])
    .map((it) => {
      const title = stripHtml(((it.title as string[]) ?? [])[0] ?? "");
      const authors = ((it.author as { given?: string; family?: string; name?: string }[]) ?? [])
        .map((a) => a.name ?? [a.given, a.family].filter(Boolean).join(" "))
        .filter(Boolean)
        .slice(0, 6);
      const parts = (it.issued as { "date-parts"?: number[][] })?.["date-parts"]?.[0];
      const date = parts?.length ? [parts[0], String(parts[1] ?? 1).padStart(2, "0"), String(parts[2] ?? 1).padStart(2, "0")].join("-") : null;
      const type = String(it.type ?? "");
      const container = ((it["container-title"] as string[]) ?? [])[0];
      return {
        kind: (type.includes("report") ? "report" : type.includes("book") ? "reference" : "paper") as SourceInput["kind"],
        title,
        authors: authors.length ? authors.join(", ") : null,
        publisher: container ?? (it.publisher as string) ?? null,
        publishedAt: date,
        url: it.DOI ? `https://doi.org/${it.DOI}` : (it.URL as string) ?? null,
        doi: (it.DOI as string) ?? null,
        excerpt: it.abstract ? truncate(stripHtml(it.abstract as string), 1500) : null,
        provider: "crossref",
      };
    })
    .filter((s) => s.title);
}

export async function searchWikipedia(query: string, limit = 3): Promise<SourceInput[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=${limit}&prop=extracts|info&exintro=1&explaintext=1&exsentences=6&inprop=url&format=json&origin=*`;
  const json = (await getJson(url)) as { query?: { pages?: Record<string, { title: string; extract?: string; fullurl?: string; touched?: string; index?: number }> } };
  return Object.values(json.query?.pages ?? {})
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((p) => ({
      kind: "reference" as const,
      title: `${p.title} — Wikipedia`,
      authors: null,
      publisher: "Wikipedia",
      publishedAt: p.touched ?? null,
      url: p.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
      excerpt: p.extract ? truncate(p.extract, 1500) : null,
      provider: "wikipedia",
      notes: "Tertiary reference: use it for orientation and follow its citations for claims.",
    }));
}

export async function searchGdelt(query: string, limit = 8): Promise<SourceInput[]> {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query + " sourcelang:english")}&mode=artlist&format=json&maxrecords=${limit}&sort=hybridrel&timespan=3months`;
  const json = (await getJson(url)) as { articles?: { url: string; title: string; seendate?: string; domain?: string; sourcecountry?: string }[] };
  return (json.articles ?? []).map((a) => {
    const d = a.seendate?.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
    return {
      kind: "news" as const,
      title: stripHtml(a.title),
      authors: null,
      publisher: a.domain ?? null,
      publishedAt: d ? `${d[1]}-${d[2]}-${d[3]}T${d[4] ?? "00"}:${d[5] ?? "00"}:00Z` : null,
      url: a.url,
      excerpt: null,
      provider: "gdelt",
      notes: a.sourcecountry ? `Source country: ${a.sourcecountry}. Found via GDELT; only the headline is known until you open it.` : "Found via GDELT; only the headline is known until you open it.",
    };
  });
}

/** Search the local corpus of ingested articles and saved sources. */
export function searchLocal(db: DB, query: string, excludeClusterId?: string | null, limit = 6): Source[] {
  const match = ftsQuery(query, "any");
  if (!match) return [];
  const rows = db
    .prepare(
      `SELECT kind, ref_id FROM search_index WHERE search_index MATCH ? AND kind IN ('article', 'source') ORDER BY bm25(search_index, 0, 0, 3.0, 1.0) LIMIT ?`,
    )
    .all(match, limit * 3) as { kind: string; ref_id: string }[];
  const out: Source[] = [];
  for (const r of rows) {
    if (r.kind === "article") {
      const cid = (db.prepare("SELECT cluster_id FROM articles WHERE id = ?").get(r.ref_id) as { cluster_id: string | null } | undefined)?.cluster_id;
      if (excludeClusterId && cid === excludeClusterId) continue;
      const s = sourceForArticle(db, r.ref_id);
      if (s) out.push(s);
    } else {
      const s = db.prepare("SELECT id FROM sources WHERE id = ?").get(r.ref_id) as { id: string } | undefined;
      if (s) out.push({ id: s.id } as Source);
    }
    if (out.length >= limit) break;
  }
  return out;
}

export interface ExploreResult {
  outcomes: ProviderOutcome[];
  sourceIds: string[];
}

/**
 * Run targeted searches for a question and store every result as a *candidate*
 * source on that question. The user decides what to attach.
 */
export async function exploreSources(
  db: DB,
  opts: { questionId: string; queries: string[]; clusterId?: string | null; providers?: ProviderId[] },
): Promise<ExploreResult> {
  const enabled = getSetting(db, "retrieval.providers");
  const providers = (opts.providers ?? (["local", "openalex", "crossref", "wikipedia", "gdelt"] as ProviderId[])).filter(
    (p) => p === "local" || enabled[p as keyof typeof enabled],
  );
  const queries = [...new Set(opts.queries.map((q) => q.trim()).filter(Boolean))].slice(0, 3);
  const outcomes: ProviderOutcome[] = [];
  const ids = new Set<string>();

  const tasks: Promise<void>[] = [];
  for (const query of queries) {
    for (const p of providers) {
      tasks.push(
        (async () => {
          try {
            if (p === "local") {
              const found = searchLocal(db, query, opts.clusterId);
              for (const s of found) {
                linkQuestionSource(db, opts.questionId, s.id, "candidate", `local: "${query}"`);
                ids.add(s.id);
              }
              outcomes.push({ provider: p, query, found: found.length });
              return;
            }
            const fn = { openalex: searchOpenAlex, crossref: searchCrossref, wikipedia: searchWikipedia, gdelt: searchGdelt }[p];
            const results = await fn(query);
            for (const r of results) {
              const s = upsertSource(db, r);
              linkQuestionSource(db, opts.questionId, s.id, "candidate", `${p}: "${query}"`);
              ids.add(s.id);
            }
            outcomes.push({ provider: p, query, found: results.length });
          } catch (err) {
            outcomes.push({ provider: p, query, found: 0, error: (err as Error).message.slice(0, 200) });
          }
        })(),
      );
    }
  }
  await Promise.all(tasks);
  return { outcomes, sourceIds: [...ids] };
}
