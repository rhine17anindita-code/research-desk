import Link from "next/link";
import { AREAS, DAY, SHORTCUTS, TASKS, TROUBLE } from "@/lib/guide";
import { GuideFinder } from "@/components/GuideFinder";

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5">
        <h1 className="font-serif text-[28px] font-semibold tracking-tight">Guide</h1>
        <p className="text-[13px] text-muted">Lost? Type what you want to do, or browse below. <span className="rounded-full bg-ok-soft px-1.5 text-ok">free</span> costs nothing; <span className="rounded-full bg-ai-soft px-1.5 text-ai">AI</span> shows its cost before it runs.</p>
      </header>

      <GuideFinder tasks={TASKS} />

      <section className="mt-8">
        <h2 className="mb-2 font-serif text-[20px] font-semibold">A typical day</h2>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {DAY.map(([t, d], i) => (
            <li key={t} className="card px-3.5 py-2.5">
              <div className="text-[12px] font-bold uppercase tracking-wide text-accent">{i + 1}. {t}</div>
              <p className="text-[13px] text-ink-2">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-serif text-[20px] font-semibold">The main areas</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {AREAS.map((a) => (
            <Link key={a.title} href={a.href} className="card block px-4 py-3 hover:border-accent/40">
              <div className="font-serif text-[16px] font-semibold text-ink">{a.title} →</div>
              <p className="text-[13px] text-ink-2">{a.what}</p>
              <ul className="mt-1 list-disc pl-4 text-[12.5px] text-ink-2">{a.use.map((u) => <li key={u}>{u}</li>)}</ul>
              <p className="mt-1 text-[11.5px] text-muted">{a.cost}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-2 font-serif text-[20px] font-semibold">If something seems off</h2>
          <dl className="space-y-2">
            {TROUBLE.map(([q, a]) => (
              <div key={q} className="card px-3.5 py-2.5">
                <dt className="text-[13px] font-semibold text-ink">{q}</dt>
                <dd className="text-[12.5px] text-ink-2">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h2 className="mb-2 font-serif text-[20px] font-semibold">Shortcuts & tricks</h2>
          <ul className="card divide-y divide-line px-3.5">
            {SHORTCUTS.map(([k, v]) => (
              <li key={k} className="flex gap-3 py-2 text-[13px]"><code className="w-44 shrink-0 text-ink">{k}</code><span className="text-ink-2">{v}</span></li>
            ))}
          </ul>
          <h2 className="mb-2 mt-6 font-serif text-[20px] font-semibold">What costs money</h2>
          <div className="card px-3.5 py-2.5 text-[12.5px] text-ink-2">
            News, talk shows, transcripts, translations, expert libraries, the At a glance summary, read time, the teleprompter, Monetise and Performance are all free.
            Only buttons marked with the AI badge spend from your budget, and each shows its worst-case cost first. Rough guide: Ask AI on one source ≈ a fraction of a cent, a solutions brief ≈ 5¢, a full YouTube production ≈ $1.
          </div>
        </section>
      </div>
    </div>
  );
}
