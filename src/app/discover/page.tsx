import Link from "next/link";
import { getDb } from "@/lib/db";
import { rankFeed, type FeedQuery } from "@/lib/ranking";
import { StoryCard } from "@/components/StoryCard";
import { AssessButton, RefreshButton, SampleButton } from "@/components/FeedActions";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | undefined>>;

export default async function DiscoverPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const db = getDb();
  const query: FeedQuery = {
    view: (sp.view as FeedQuery["view"]) ?? "ranked",
    signal: sp.signal || undefined,
    region: sp.region || undefined,
    publisher: sp.publisher || undefined,
    q: sp.q || undefined,
    minSources: sp.min ? Number(sp.min) : undefined,
    hours: sp.hours ? Number(sp.hours) : undefined,
  };
  const { items, totalCandidates } = rankFeed(db, { ...query, limit: 60 });
  const signals = db.prepare("SELECT id, label, weight + learned AS w FROM signals WHERE enabled = 1 ORDER BY w DESC").all() as { id: string; label: string; w: number }[];
  const signalLabels = Object.fromEntries(signals.map((s) => [s.id, s.label]));
  const regions = (db.prepare("SELECT DISTINCT region FROM feeds WHERE region IS NOT NULL ORDER BY region").all() as { region: string }[]).map((r) => r.region);
  const publishers = (db.prepare("SELECT name FROM feeds WHERE enabled = 1 ORDER BY name").all() as { name: string }[]).map((r) => r.name);
  const lastRun = db.prepare("SELECT finished_at, articles_new FROM ingest_runs WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1").get() as { finished_at: string; articles_new: number } | undefined;
  const totals = db.prepare("SELECT (SELECT COUNT(*) FROM articles) AS a, (SELECT COUNT(*) FROM clusters) AS c, (SELECT COUNT(*) FROM feeds WHERE enabled = 1) AS f").get() as { a: number; c: number; f: number };
  const hasSample = !!db.prepare("SELECT 1 FROM clusters WHERE is_sample = 1 LIMIT 1").get();

  const href = (patch: Record<string, string | undefined>) => {
    const next = { ...sp, ...patch };
    const qs = Object.entries(next).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join("&");
    return `/discover${qs ? `?${qs}` : ""}`;
  };
  const view = query.view;

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-[28px] font-semibold tracking-tight">Discover</h1>
          <p className="text-[13px] text-muted">
            {totals.c.toLocaleString()} stories from {totals.a.toLocaleString()} articles across {totals.f} feeds
            {lastRun ? ` · updated ${timeAgo(lastRun.finished_at)}` : ""}
          </p>
        </div>
        <RefreshButton />
      </header>

      {hasSample && (
        <div className="mb-4 rounded-md border border-warn/30 bg-warn-soft px-3 py-2 text-[13px] text-warn">
          Fictional sample stories are loaded for trying out the workflow. They are labelled “Sample”. Remove them in Settings → Sources.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-1 border-b border-line">
            {[
              ["ranked", "For you"],
              ["latest", "Latest"],
              ["saved", "Saved"],
              ["dismissed", "Hidden"],
            ].map(([v, label]) => (
              <Link
                key={v}
                href={href({ view: v === "ranked" ? undefined : v })}
                className={`-mb-px border-b-2 px-3 py-2 text-[13.5px] font-medium ${view === v ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}
              >
                {label}
              </Link>
            ))}
            <div className="ml-auto pb-1.5">
              {view === "ranked" && <AssessButton ids={items.filter((i) => !i.isSample).slice(0, 15).map((i) => i.id)} />}
            </div>
          </div>

          <form className="mb-4 flex flex-wrap gap-2" action="/discover">
            {view !== "ranked" && <input type="hidden" name="view" value={view} />}
            <input name="q" defaultValue={sp.q} placeholder="Filter by words…" className="input !w-48 flex-1" />
            <select name="signal" defaultValue={sp.signal ?? ""} className="input !w-auto">
              <option value="">Any signal</option>
              {signals.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <select name="region" defaultValue={sp.region ?? ""} className="input !w-auto">
              <option value="">Any region</option>
              {regions.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <select name="publisher" defaultValue={sp.publisher ?? ""} className="input !w-auto max-w-[180px]">
              <option value="">Any outlet</option>
              {publishers.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select name="min" defaultValue={sp.min ?? ""} className="input !w-auto">
              <option value="">Any coverage</option>
              <option value="2">2+ outlets</option>
              <option value="3">3+ outlets</option>
            </select>
            <select name="hours" defaultValue={sp.hours ?? ""} className="input !w-auto">
              <option value="">Default window</option>
              <option value="24">Last 24h</option>
              <option value="72">Last 3 days</option>
              <option value="168">Last week</option>
              <option value="720">Last 30 days</option>
            </select>
            <button className="btn">Apply</button>
            {Object.keys(sp).some((k) => k !== "view") && (
              <Link className="btn-ghost" href={view === "ranked" ? "/discover" : `/discover?view=${view}`}>
                Clear
              </Link>
            )}
          </form>

          {items.length === 0 ? (
            <div className="card px-6 py-10 text-center">
              {totals.c === 0 ? (
                <>
                  <h2 className="font-serif text-[20px] font-semibold">No news collected yet</h2>
                  <p className="mx-auto mt-1 max-w-md text-[13.5px] text-muted">
                    Fetch the configured RSS feeds to build your first feed. If you are offline, you can load clearly labelled fictional stories to try the research workflow.
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <RefreshButton label="Fetch news now" primary />
                    <SampleButton />
                  </div>
                </>
              ) : (
                <p className="text-[13.5px] text-muted">Nothing matches these filters.</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {items.map((s, i) => (
                <StoryCard key={s.id} story={s} signalLabels={signalLabels} rank={view === "ranked" ? i + 1 : undefined} />
              ))}
              {totalCandidates > items.length && <p className="py-3 text-center text-[12.5px] text-muted">Showing the top {items.length} of {totalCandidates}. Narrow with filters to see others.</p>}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="card p-4">
            <div className="eyebrow mb-2">Your editorial interests</div>
            <ul className="space-y-1.5">
              {signals.map((s) => (
                <li key={s.id}>
                  <Link href={href({ signal: sp.signal === s.id ? undefined : s.id })} className={`flex items-center justify-between gap-2 text-[13px] ${sp.signal === s.id ? "font-medium text-accent" : "text-ink-2 hover:text-ink"}`}>
                    <span>{s.label}</span>
                    <span className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full bg-accent/70" style={{ width: `${Math.min(100, Math.max(4, (s.w / 3) * 100))}%` }} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              Weights grow as you mark stories interesting and say why. Adjust them, add your own signals, or create rules in{" "}
              <Link href="/settings?tab=personalisation" className="text-accent hover:underline">Settings</Link>.
            </p>
          </div>
          <div className="card p-4 text-[12.5px] leading-relaxed text-muted">
            <div className="eyebrow mb-1.5">How ranking works</div>
            Stories are grouped across outlets and scored locally from editorial signals in the text, breadth of coverage, recency, your source and region priorities, rules, and what you have liked before. No AI is used unless you click <span className="text-ai">Assess with AI</span>.
          </div>
        </aside>
      </div>
    </div>
  );
}
