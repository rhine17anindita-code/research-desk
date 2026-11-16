import Link from "next/link";
import { getDb } from "@/lib/db";
import { tasteStats } from "@/lib/ideation/repo";
import { getSetting } from "@/lib/repo/settings";
import { ANGLE_TYPES, FORMAT_BY_ID } from "@/lib/ideation/formats";
import { TasteSummaryEditor } from "@/components/ideas/TasteSummaryEditor";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

function Bars({ rows, label }: { rows: { id: string; liked: number; passed: number; score: number }[]; label: (id: string) => string }) {
  if (!rows.length) return <p className="text-[12.5px] text-muted">Not enough choices yet.</p>;
  return (
    <ul className="space-y-1.5">
      {rows.slice(0, 10).map((r) => (
        <li key={r.id} className="text-[12.5px]">
          <div className="flex justify-between gap-2">
            <span className="truncate text-ink-2">{label(r.id)}</span>
            <span className="shrink-0 tabular-nums text-muted">{r.liked} kept · {r.passed} skipped</span>
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent/70" style={{ width: `${Math.round(r.score * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function TastePage() {
  const db = getDb();
  const updatedAt = getSetting(db, "taste.updated_at");
  const stats = tasteStats(db, updatedAt || undefined);
  const summary = getSetting(db, "taste.summary");
  const profile = getSetting(db, "profile.about");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-5">
        <div className="card p-4">
          <h2 className="font-serif text-[19px] font-semibold">Your taste, in words</h2>
          <p className="mb-2 text-[12.5px] text-muted">
            This summary is included in every AI request (ideas, questions, answers, assistant), together with your <Link href="/settings?tab=personalisation" className="text-accent hover:underline">research profile</Link>
            {profile ? "" : " — which you haven't filled in yet"}. Edit it freely; it&apos;s yours.
            {updatedAt ? ` Last updated ${timeAgo(updatedAt)}; ${stats.eventsSinceSummary} new choices since.` : ""}
          </p>
          <TasteSummaryEditor initial={summary} eventsSince={stats.eventsSinceSummary} />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="card p-4">
            <div className="eyebrow mb-2">Formats</div>
            <Bars rows={stats.formats} label={(id) => FORMAT_BY_ID[id]?.label ?? id} />
          </div>
          <div className="card p-4">
            <div className="eyebrow mb-2">Kinds of angle</div>
            <Bars rows={stats.angleTypes} label={(id) => ANGLE_TYPES[id]?.split(" — ")[0] ?? id} />
          </div>
        </div>
      </section>
      <aside className="space-y-4">
        <div className="card p-4">
          <div className="eyebrow mb-2">Words in what you keep</div>
          <div className="flex flex-wrap gap-1">
            {stats.likedTerms.map((t) => <span key={t.term} className="chip border-ok/30 text-ok">{t.term} <span className="opacity-60">{t.n}</span></span>)}
            {!stats.likedTerms.length && <span className="text-[12.5px] text-muted">Nothing yet.</span>}
          </div>
          <div className="eyebrow mb-2 mt-4">Words in what you skip</div>
          <div className="flex flex-wrap gap-1">
            {stats.passedTerms.map((t) => <span key={t.term} className="chip border-bad/30 text-bad">{t.term} <span className="opacity-60">{t.n}</span></span>)}
            {!stats.passedTerms.length && <span className="text-[12.5px] text-muted">Nothing yet.</span>}
          </div>
          <div className="eyebrow mb-2 mt-4">Reasons you gave</div>
          <ul className="space-y-0.5 text-[12.5px] text-ink-2">
            {stats.reasons.map((r) => <li key={r.reason}>{r.reason} <span className="text-muted">×{r.n}</span></li>)}
            {!stats.reasons.length && <li className="text-muted">Tap a reason after skipping or saving an idea.</li>}
          </ul>
        </div>
        <p className="text-[12px] leading-relaxed text-muted">
          {stats.events} signals recorded on this machine: idea saves, skips and developments, inspirations, and stories you marked interesting or not. The untold-story finder and every new idea batch use them immediately; the written summary updates when you ask.
        </p>
      </aside>
    </div>
  );
}
