import type { DB } from "../db";
import { parseJson } from "../db";
import { activeChannel, activeChannelId } from "../channels";
import { newId, nowIso } from "../ids";
import { getProduction } from "../production";
import { performance, LABEL } from "../performance/patterns";
import { DEFAULT_AVOID, DEFAULT_RATES, PLAYS, SERIES, SPONSOR_CATEGORIES, SPONSORS, type Goal, type PlayKind, type RateSettings } from "./library";

/**
 * Monetisation without AI: the creator's own library of ways to grow and earn (seeded from the
 * built-in playbook, fully editable), Bangladeshi sponsors with a simple pipeline, series made to
 * be sponsored, a rate card worked out from their real numbers, and proposals from templates.
 * Matching to a project is rule-based (topic and sensitivity from the words used).
 */

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface MonSettings {
  goals: Record<Goal, number>; // 0–100: how much each matters
  avoid: string[];
  rates: RateSettings;
  maxSponsoredPerMonth: number;
  contactName: string;
  contactEmail: string;
}

const defaults = (): MonSettings => ({
  goals: { grow: 80, earn: 50, community: 60, authority: 60 },
  avoid: [...DEFAULT_AVOID],
  rates: DEFAULT_RATES,
  maxSponsoredPerMonth: 2,
  contactName: "",
  contactEmail: "",
});

export function getMonSettings(db: DB, channelId = activeChannelId(db)): MonSettings {
  const r = db.prepare("SELECT monetise FROM channels WHERE id = ?").get(channelId) as { monetise: string } | undefined;
  const s = parseJson<Partial<MonSettings>>(r?.monetise ?? "{}", {});
  const d = defaults();
  return { ...d, ...s, goals: { ...d.goals, ...(s.goals ?? {}) }, rates: { ...d.rates, ...(s.rates ?? {}) } };
}

export function updateMonSettings(db: DB, patch: Partial<MonSettings>, channelId = activeChannelId(db)): MonSettings {
  const n = { ...getMonSettings(db, channelId), ...patch };
  db.prepare("UPDATE channels SET monetise = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(n), nowIso(), channelId);
  return n;
}

// ---------------------------------------------------------------------------
// The library (copied into the channel's own storage on first use)
// ---------------------------------------------------------------------------

export function ensureSeeded(db: DB, channelId = activeChannelId(db)) {
  const has = db.prepare("SELECT 1 FROM mon_items WHERE channel_id = ? LIMIT 1").get(channelId);
  if (has) return;
  const now = nowIso();
  db.transaction(() => {
    const it = db.prepare("INSERT INTO mon_items (id, channel_id, kind, title, how, example, formats, goals, effort, sensitive_ok, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'library', ?, ?)");
    for (const p of PLAYS) it.run(newId("mi"), channelId, p.kind, p.title, p.how, p.example, JSON.stringify(p.formats), JSON.stringify(p.goals), p.effort, p.sensitiveOk ? 1 : 0, now, now);
    const sp = db.prepare("INSERT INTO mon_sponsors (id, channel_id, name, category, fits, notes, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'library', ?, ?)");
    for (const s of SPONSORS) sp.run(newId("ms"), channelId, s.name, s.category, JSON.stringify(s.fits), s.notes, now, now);
    const se = db.prepare("INSERT INTO mon_series (id, channel_id, name, premise, episodes, categories, format, integration, sentiment, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'library', ?, ?)");
    for (const s of SERIES) se.run(newId("mse"), channelId, s.name, s.premise, JSON.stringify(s.episodes), JSON.stringify(s.categories), s.format, s.integration, s.sentiment, now, now);
  })();
}

export interface MonItem { id: string; kind: PlayKind; title: string; how: string; example: string; formats: string[]; goals: Goal[]; effort: string | null; sensitiveOk: boolean; source: string; starred: boolean; hidden: boolean; notes: string }
export interface MonSponsor { id: string; name: string; category: string; fits: string[]; notes: string; status: string; contact: string; lastContact: string | null; source: string }
export interface MonSeries { id: string; name: string; premise: string; episodes: string[]; categories: string[]; format: string; integration: string; sentiment: string; status: string; source: string }
export interface MonProposal { id: string; sponsorId: string | null; seriesId: string | null; projectId: string | null; title: string; body: string; status: string; priceLow: number | null; priceHigh: number | null; createdAt: string; updatedAt: string }

type R = Record<string, unknown>;
const item = (r: R): MonItem => ({
  id: String(r.id), kind: r.kind as PlayKind, title: String(r.title), how: String(r.how), example: String(r.example), formats: parseJson(String(r.formats), []), goals: parseJson(String(r.goals), []),
  effort: (r.effort as string) ?? null, sensitiveOk: !!r.sensitive_ok, source: String(r.source), starred: !!r.starred, hidden: !!r.hidden, notes: String(r.notes ?? ""),
});
const sponsor = (r: R): MonSponsor => ({
  id: String(r.id), name: String(r.name), category: String(r.category), fits: parseJson(String(r.fits), []), notes: String(r.notes), status: String(r.status), contact: String(r.contact ?? ""),
  lastContact: (r.last_contact as string) ?? null, source: String(r.source),
});
const series = (r: R): MonSeries => ({
  id: String(r.id), name: String(r.name), premise: String(r.premise), episodes: parseJson(String(r.episodes), []), categories: parseJson(String(r.categories), []), format: String(r.format),
  integration: String(r.integration), sentiment: String(r.sentiment), status: String(r.status), source: String(r.source),
});
const proposal = (r: R): MonProposal => ({
  id: String(r.id), sponsorId: (r.sponsor_id as string) ?? null, seriesId: (r.series_id as string) ?? null, projectId: (r.project_id as string) ?? null, title: String(r.title), body: String(r.body),
  status: String(r.status), priceLow: (r.price_low as number) ?? null, priceHigh: (r.price_high as number) ?? null, createdAt: String(r.created_at), updatedAt: String(r.updated_at),
});

export function listItems(db: DB): MonItem[] {
  ensureSeeded(db);
  return (db.prepare("SELECT * FROM mon_items WHERE channel_id = ? ORDER BY starred DESC, kind, created_at").all(activeChannelId(db)) as R[]).map(item);
}
export function listSponsors(db: DB): MonSponsor[] {
  ensureSeeded(db);
  return (db.prepare("SELECT * FROM mon_sponsors WHERE channel_id = ? ORDER BY CASE status WHEN 'won' THEN 0 WHEN 'talking' THEN 1 WHEN 'contacted' THEN 2 WHEN 'idea' THEN 3 ELSE 4 END, category, name").all(activeChannelId(db)) as R[]).map(sponsor);
}
export function listSeries(db: DB): MonSeries[] {
  ensureSeeded(db);
  return (db.prepare("SELECT * FROM mon_series WHERE channel_id = ? ORDER BY CASE status WHEN 'running' THEN 0 WHEN 'sold' THEN 1 WHEN 'pitching' THEN 2 ELSE 3 END, created_at").all(activeChannelId(db)) as R[]).map(series);
}
export function listProposals(db: DB): MonProposal[] {
  return (db.prepare("SELECT * FROM mon_proposals WHERE channel_id = ? ORDER BY updated_at DESC").all(activeChannelId(db)) as R[]).map(proposal);
}

const TABLES = { item: "mon_items", sponsor: "mon_sponsors", series: "mon_series", proposal: "mon_proposals" } as const;
const FIELDS: Record<keyof typeof TABLES, Record<string, "text" | "json" | "bool" | "int">> = {
  item: { kind: "text", title: "text", how: "text", example: "text", formats: "json", goals: "json", effort: "text", sensitive_ok: "bool", starred: "bool", hidden: "bool", notes: "text" },
  sponsor: { name: "text", category: "text", fits: "json", notes: "text", status: "text", contact: "text", last_contact: "text" },
  series: { name: "text", premise: "text", episodes: "json", categories: "json", format: "text", integration: "text", sentiment: "text", status: "text" },
  proposal: { title: "text", body: "text", status: "text", price_low: "int", price_high: "int" },
};
const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const enc = (type: string, v: unknown) => (type === "json" ? JSON.stringify(v ?? []) : type === "bool" ? (v ? 1 : 0) : type === "int" ? (v == null ? null : Math.round(Number(v))) : String(v ?? ""));

/** Add an entry of your own. */
export function addEntry(db: DB, kind: keyof typeof TABLES, data: R): string {
  const id = newId(kind === "item" ? "mi" : kind === "sponsor" ? "ms" : kind === "series" ? "mse" : "mp");
  const fields = FIELDS[kind];
  const cols = Object.keys(fields).filter((f) => data[f] !== undefined || data[camel(f)] !== undefined);
  const now = nowIso();
  db.prepare(`INSERT INTO ${TABLES[kind]} (id, channel_id, ${cols.join(", ")}${kind === "proposal" ? "" : ", source"}, created_at, updated_at) VALUES (?, ?, ${cols.map(() => "?").join(", ")}${kind === "proposal" ? "" : ", 'mine'"}, ?, ?)`).run(
    id, activeChannelId(db), ...cols.map((c) => enc(fields[c], data[c] ?? data[camel(c)])), now, now,
  );
  return id;
}
const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export function updateEntry(db: DB, kind: keyof typeof TABLES, id: string, data: R) {
  const fields = FIELDS[kind];
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(data)) {
    const col = snake(k);
    if (!fields[col]) continue;
    sets.push(`${col} = ?`);
    vals.push(enc(fields[col], v));
  }
  if (!sets.length) return;
  db.prepare(`UPDATE ${TABLES[kind]} SET ${sets.join(", ")}, updated_at = ? WHERE id = ? AND channel_id = ?`).run(...vals, nowIso(), id, activeChannelId(db));
}

export function deleteEntry(db: DB, kind: keyof typeof TABLES, id: string) {
  db.prepare(`DELETE FROM ${TABLES[kind]} WHERE id = ? AND channel_id = ?`).run(id, activeChannelId(db));
}

// ---------------------------------------------------------------------------
// Reading a piece of content (rule-based)
// ---------------------------------------------------------------------------

const TOPIC_WORDS: Record<string, RegExp> = {
  money: /\b(money|taka|price|prices|loan|bank|budget|tax|salary|wage|inflation|economy|economic|imf|debt|saving|invest|fee|cost)/i,
  remittance: /\b(remittance|migrant|gulf|expat|probashi|sending money)/i,
  economy: /\b(economy|gdp|export|garment|rmg|trade|tariff|industry|growth)/i,
  youth: /\b(student|youth|young|gen ?z|university|campus|job|career|exam)/i,
  education: /\b(education|exam|school|university|ssc|hsc|bcs|study|learn|curriculum)/i,
  career: /\b(job|career|salary|skills|employ|hiring|abroad)/i,
  history: /\b(history|historic|liberation|1971|1952|mughal|british|colonial|partition|ancient|forgotten|myth|origin)/i,
  culture: /\b(cultur\w*|festival\w*|eid\b|puja\b|boishakh|music\w*|films?\b|books?\b|art\b|arts\b|cuisine|tradition\w*|heritage|fashion|muslin|jamdani)/i,
  film: /\b(films?\b|movies?\b|cinema\w*|ott\b|dramas?\b|actors?\b|streaming)/i,
  travel: /\b(travel|tourism|tourist|place|city|village|river|island|sundarbans|cox'?s bazar|sylhet|trip)/i,
  geography: /\b(maps?\b|borders?\b|rivers?\b|delta\b|district\w*|geograph\w*)/i,
  tech: /\b(tech\w*|internet|data\b|mobile|phones?\b|apps?\b|ai\b|artificial intelligence|digital|online|scam\w*|cyber\w*|startup\w*|social media)/i,
  food: /\b(food\w*|rice\b|onions?\b|eggs?\b|fish\b|hilsa|grocer\w*|restaurant\w*|street food)/i,
  health: /\b(health|hospital|dengue|disease|medicine|doctor|mental health)/i,
  climate: /\b(climate|flood|cyclone|heat|river erosion|salinity|environment|pollution|air quality|energy|solar)/i,
  civic: /\b(vot(e|es|ing|er|ers)\b|citizen\w*|constitution\w*|reforms?\b|accountab\w*)/i,
  politics: /\b(bnp|awami|jamaat|ncp|election|minister|government|parliament|party|hasina|yunus|tarique|politic|protest)/i,
  rights: /\b(rights|justice|court|verdict|torture|disappear|rape|abuse|freedom)/i,
  conflict: /\b(war\b|wars\b|attack\w*|killed|death\b|deaths\b|dead\b|violence|clash\w*|bomb\w*|military|army\b|terror\w*|genocide|rohingya)/i,
  gaming: /\b(gam(e|es|ing|er|ers)\b|gta\b|esports?|playstation|xbox|nintendo|streamers?\b|creators?\b|influencers?\b|youtubers?\b)/i,
};

export function topicsOf(text: string): string[] {
  return Object.entries(TOPIC_WORDS).filter(([, re]) => re.test(text)).map(([t]) => t);
}

/** Would most brands sponsor this? Political, crime and conflict stories usually not. */
export function brandSafety(topics: string[]): { level: "brand-safe" | "mixed" | "sensitive"; note: string } {
  const hot = topics.filter((t) => ["politics", "rights", "conflict"].includes(t));
  if (hot.length >= 2 || topics.includes("conflict")) return { level: "sensitive", note: "Most product brands avoid political, crime and conflict stories. Earn here through growth (CTAs, follow-ups), your own offers, memberships, or CSR/development partners — not product sponsors." };
  if (hot.length) return { level: "mixed", note: "Some brands will pass because it touches politics or rights. A neutral ‘supported by’ line from a bank, telecom or CSR partner can work; product placement won't." };
  return { level: "brand-safe", note: "Brand-friendly: evergreen, positive or neutral. A good fit for sponsors, especially as part of a named series." };
}

// ---------------------------------------------------------------------------
// Rate card from the creator's real numbers
// ---------------------------------------------------------------------------

export interface RateLine { deliverable: string; basis: string; low: number; high: number }

const round500 = (n: number) => Math.round(n / 500) * 500;

export function rateCard(db: DB): { lines: RateLine[]; reach: { platform: string; followers: number | null; typical: number; metric: string }[]; note: string } {
  const s = getMonSettings(db);
  const perf = performance(db);
  const reach = perf.summaries.map((x) => ({ platform: x.label, followers: x.followers, typical: Math.round(x.typical), metric: x.metric }));
  // Short-form views: the best platform's typical post; long-form: YouTube long videos if any, else Facebook videos.
  const best = Math.max(0, ...perf.summaries.map((x) => x.typical));
  const longBase = perf.summaries.find((x) => x.platform === "facebook")?.typical ?? best;
  const r = s.rates;
  const price = (views: number, [lo, hi]: [number, number], min: number): [number, number] => [round500(Math.max(min, (views / 1000) * lo)), round500(Math.max(min * 1.4, (views / 1000) * hi))];
  const short = price(best, r.perThousandViews.short, r.minimum.short);
  const video = price(longBase, r.perThousandViews.video, r.minimum.video);
  const carousel = price(best * 0.6, r.perThousandViews.carousel, r.minimum.carousel);
  const lines: RateLine[] = [
    { deliverable: "Short / Reel integration (bookend or prop)", basis: `~${Math.round(best).toLocaleString()} typical views`, low: short[0], high: short[1] },
    { deliverable: "Long video: 45–60s segment", basis: `~${Math.round(longBase).toLocaleString()} typical views`, low: video[0], high: video[1] },
    { deliverable: "Dedicated video (product is the topic)", basis: `${r.dedicatedMultiplier}× an integration`, low: round500(video[0] * r.dedicatedMultiplier), high: round500(video[1] * r.dedicatedMultiplier) },
    { deliverable: "Carousel (first/last slide)", basis: "Instagram/Facebook", low: carousel[0], high: carousel[1] },
    { deliverable: "Series sponsor: 8 Shorts", basis: `8 × Short, ${Math.round(r.seriesDiscount * 100)}% series discount`, low: round500(short[0] * 8 * (1 - r.seriesDiscount)), high: round500(short[1] * 8 * (1 - r.seriesDiscount)) },
    { deliverable: "Add-on: cross-post to other platforms", basis: `+${Math.round(r.crossPost * 100)}%`, low: round500(short[0] * r.crossPost), high: round500(short[1] * r.crossPost) },
    { deliverable: "Add-on: brand may reuse the video (per month)", basis: `+${Math.round(r.usageRightsPerMonth * 100)}% per month`, low: round500(short[0] * r.usageRightsPerMonth), high: round500(short[1] * r.usageRightsPerMonth) },
    { deliverable: "Add-on: category exclusivity (30 days)", basis: `+${Math.round(r.exclusivity * 100)}%`, low: round500(short[0] * r.exclusivity), high: round500(short[1] * r.exclusivity) },
  ];
  return { lines, reach, note: "Starting points worked out from your typical views and the per-1,000-view rates in your settings — not market data. Adjust the rates to what you've been offered or charged before." };
}

// ---------------------------------------------------------------------------
// A plan for one project
// ---------------------------------------------------------------------------

export interface ProjectPlan {
  topics: string[];
  safety: ReturnType<typeof brandSafety>;
  format: string;
  categories: { id: string; label: string; angle: string }[];
  sponsors: MonSponsor[];
  integrations: MonItem[];
  growth: MonItem[];
  followups: MonItem[];
  offers: MonItem[];
  series: MonSeries[];
  price: RateLine | null;
  picks: string[];
}

export function planFor(db: DB, projectId: string): ProjectPlan | null {
  const p = getProduction(db, projectId);
  if (!p) return null;
  const proj = db.prepare("SELECT title, thesis FROM projects WHERE id = ?").get(projectId) as { title: string; thesis: string | null } | undefined;
  const text = `${p.title} ${proj?.thesis ?? ""} ${(p.docs.hook ?? "")} ${(p.docs.script ?? "").slice(0, 3000)}`;
  const topics = topicsOf(text);
  const safety = brandSafety(topics);
  const format = ["short", "carousel", "podcast"].includes(p.contentType) ? p.contentType : p.contentType === "carousel" ? "carousel" : "video";
  const s = getMonSettings(db);
  const avoidText = s.avoid.join(" ").toLowerCase();
  const catScore = Object.entries(SPONSOR_CATEGORIES)
    .map(([id, c]) => ({ id, label: c.label, angle: c.angle, score: c.topics.filter((t) => topics.includes(t)).length + (safety.level === "sensitive" && id === "csr" ? 2 : 0) }))
    .filter((c) => c.score > 0 && (safety.level !== "sensitive" || c.id === "csr"))
    .sort((a, b) => b.score - a.score);
  const cats = catScore.slice(0, 4);
  // Up to 3 per matching category, best-fitting category first (brands you're already talking to come first within each).
  const pool = listSponsors(db).filter((sp) => sp.status !== "not-for-me" && !avoidText.includes(sp.name.toLowerCase()));
  const sponsors = cats.flatMap((c) => pool.filter((sp) => sp.category === c.id).slice(0, 3)).slice(0, 10);
  const items = listItems(db).filter((i) => !i.hidden);
  const fits = (i: MonItem) => (i.formats.includes(format) || i.formats.includes("any")) && (safety.level === "brand-safe" || i.sensitiveOk || i.kind !== "integration");
  const goalScore = (i: MonItem) => i.goals.reduce((n, g) => n + (s.goals[g] ?? 0), 0) / Math.max(1, i.goals.length) + (i.starred ? 50 : 0) + (i.effort === "low" ? 10 : 0);
  const byKind = (k: PlayKind | PlayKind[], n: number) => items.filter((i) => ([] as PlayKind[]).concat(k).includes(i.kind) && fits(i)).sort((a, b) => goalScore(b) - goalScore(a)).slice(0, n);
  const integrations = safety.level === "sensitive" ? items.filter((i) => i.kind === "integration" && i.sensitiveOk) : byKind("integration", 3);
  const seriesList = listSeries(db).filter((x) => x.categories.some((c) => cats.some((k) => k.id === c))).slice(0, 3);
  const card = rateCard(db);
  const price = card.lines.find((l) => (format === "short" ? /Short \/ Reel/ : format === "carousel" ? /Carousel/ : /Long video/).test(l.deliverable)) ?? null;
  const picks = (() => {
    try {
      return p.docs.monetise ? (JSON.parse(p.docs.monetise) as string[]) : [];
    } catch {
      return [];
    }
  })();
  return {
    topics, safety, format, categories: cats.map(({ id, label, angle }) => ({ id, label, angle })), sponsors, integrations, growth: byKind(["cta", "collab"], 4),
    followups: byKind("followup", 4), offers: byKind(["offer", "community"], 3), series: seriesList, price: safety.level === "sensitive" ? null : price, picks,
  };
}

// ---------------------------------------------------------------------------
// Proposals from templates
// ---------------------------------------------------------------------------

export interface ProposalInput {
  sponsorId?: string | null;
  seriesId?: string | null;
  projectId?: string | null;
  deliverables: { label: string; count: number; low: number; high: number }[];
  addOns?: string[];
  timeline?: string;
  notes?: string;
}

const fmt = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;

export function buildProposal(db: DB, input: ProposalInput): { title: string; body: string; low: number; high: number } {
  const ch = activeChannel(db);
  const s = getMonSettings(db);
  const sp = input.sponsorId ? listSponsors(db).find((x) => x.id === input.sponsorId) : undefined;
  const se = input.seriesId ? listSeries(db).find((x) => x.id === input.seriesId) : undefined;
  const pr = input.projectId ? getProduction(db, input.projectId) : null;
  const perf = performance(db);
  const cat = sp ? SPONSOR_CATEGORIES[sp.category] : undefined;
  const concept = se ? se.name : pr ? pr.title : "A sponsored explainer";
  const integ = listItems(db).filter((i) => i.kind === "integration" && !i.hidden && (se ? true : pr ? i.formats.includes(pr.contentType === "short" ? "short" : "video") : true)).slice(0, 3);
  const low = input.deliverables.reduce((n, d) => n + d.low * d.count, 0);
  const high = input.deliverables.reduce((n, d) => n + d.high * d.count, 0);
  const totalFollowers = perf.summaries.reduce((n, x) => n + (x.followers ?? 0), 0);
  const title = `${concept}${sp ? ` × ${sp.name}` : ""} — partnership proposal`;
  const body = [
    `# ${title}`,
    "",
    `Prepared by ${s.contactName || ch.name}${s.contactEmail ? ` · ${s.contactEmail}` : ""} · ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
    "",
    "## The idea",
    se ? `**${se.name}** — ${se.premise}` : pr ? `**${pr.title}**` : concept,
    se?.episodes.length ? `\nEpisodes we have in mind:\n${se.episodes.map((e) => `- ${e}`).join("\n")}` : "",
    cat ? `\n**Why ${sp!.name}:** ${cat.angle}` : "",
    "",
    "## Who you'll reach",
    ch.description ? `${ch.name}: ${ch.description}.` : `${ch.name}.`,
    "English-language explainers on Bangladesh and the world, for an audience of mostly 18–30 year-olds in Bangladesh and the diaspora — students and young professionals who want to understand what's happening, not just hear it.",
    "",
    perf.summaries.length ? `| Platform | Followers | Typical views per post |\n|---|---|---|\n${perf.summaries.map((x) => `| ${x.label} | ${x.followers != null ? x.followers.toLocaleString() : "—"} | ${Math.round(x.typical).toLocaleString()} |`).join("\n")}` : "",
    totalFollowers ? `\n**${totalFollowers.toLocaleString()} followers across platforms.**` : "",
    perf.top.length ? `\nRecent best performers:\n${perf.top.slice(0, 3).map((p) => `- “${p.title.slice(0, 90)}” — ${Math.round(p.metric).toLocaleString()} ${p.views != null ? "views" : "reach"} (${LABEL[p.platform]})`).join("\n")}` : "",
    "",
    "## How your brand appears — without losing the audience",
    "We protect the first seconds and the story; that's what keeps people watching and makes your mention land.",
    ...integ.map((i) => `- **${i.title}.** ${i.how}${i.example ? ` _Example: ${i.example}_` : ""}`),
    se?.integration ? `- **For this series:** ${se.integration}` : "",
    "",
    "## Deliverables",
    "| Deliverable | Qty | Investment |\n|---|---|---|",
    ...input.deliverables.map((d) => `| ${d.label} | ${d.count} | ${fmt(d.low * d.count)}–${fmt(d.high * d.count)} |`),
    `| **Total** | | **${fmt(low)}–${fmt(high)}** |`,
    input.addOns?.length ? `\nOptional add-ons: ${input.addOns.join("; ")}.` : "",
    "",
    "## Timeline",
    input.timeline || "Concept and talking points shared 5 working days before publishing; publishing on agreed dates; results report 7 and 30 days after each post.",
    "",
    "## Reporting",
    "Views, reach, watch time (where available), saves, shares, comments and link clicks/code uses — at 7 and 30 days, with screenshots from the platforms.",
    "",
    "## How we work",
    "- **Disclosure:** every sponsored post uses the platform's paid-partnership label and says so in the caption.",
    "- **Editorial independence:** you review how your brand is mentioned and any claims about your product; the reporting and conclusions stay ours.",
    "- **Brand safety:** sponsored episodes are evergreen, positive or neutral topics — never political or crisis coverage.",
    "- **Payment:** 50% on signing, 50% on publishing.",
    input.notes ? `\n## Notes\n${input.notes}` : "",
    "",
    `Let's talk${s.contactEmail ? ` — ${s.contactEmail}` : ""}.`,
  ].filter((l) => l !== "").join("\n");
  return { title, body, low, high };
}

export function saveProposal(db: DB, input: ProposalInput): MonProposal {
  const b = buildProposal(db, input);
  const id = newId("mp");
  const now = nowIso();
  db.prepare("INSERT INTO mon_proposals (id, channel_id, sponsor_id, series_id, project_id, title, body, status, price_low, price_high, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)").run(
    id, activeChannelId(db), input.sponsorId ?? null, input.seriesId ?? null, input.projectId ?? null, b.title, b.body, b.low, b.high, now, now,
  );
  return proposal(db.prepare("SELECT * FROM mon_proposals WHERE id = ?").get(id) as R);
}
