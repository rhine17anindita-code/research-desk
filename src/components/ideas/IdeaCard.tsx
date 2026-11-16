import Link from "next/link";
import { ANGLE_TYPES, FORMAT_BY_ID } from "@/lib/ideation/formats";
import type { Idea } from "@/lib/ideation/repo";

export interface BackingInfo {
  stories: { id: string; headline: string; sourceCount: number }[];
  sources: { id: string; title: string; publisher: string | null; url: string | null }[];
}

export function FormatChip({ format }: { format: string }) {
  const f = FORMAT_BY_ID[format];
  return (
    <span className={`chip ${f?.medium === "written" ? "border-warn/30 text-warn" : "border-accent/30 text-accent"}`} title={f?.craft}>
      {f?.label ?? format} <span className="opacity-60">· {f?.platform}</span>
    </span>
  );
}

/** Full idea card: what to make, why it's untold, and the research behind it. */
export function IdeaCard({ idea, backing, compact = false }: { idea: Idea; backing: BackingInfo; compact?: boolean }) {
  return (
    <article className="card overflow-hidden">
      <div className="border-b border-line bg-surface-2/60 px-5 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
          <FormatChip format={idea.format} />
          {idea.angleType && <span className="chip" title={ANGLE_TYPES[idea.angleType]}>{ANGLE_TYPES[idea.angleType]?.split(" — ")[0] ?? idea.angleType}</span>}
          {idea.timeliness && <span className="chip">{idea.timeliness}</span>}
          {idea.effort && <span className="chip">{idea.effort} effort</span>}
          {idea.origin === "ai" && <span className="ml-auto rounded bg-ai-soft px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide text-ai">AI idea</span>}
        </div>
      </div>
      <div className="space-y-3.5 px-5 py-4">
        <h2 className={`font-serif font-semibold leading-snug tracking-tight text-ink ${compact ? "text-[19px]" : "text-[24px]"}`}>{idea.title}</h2>
        {idea.hook && <blockquote className="border-l-2 border-accent pl-3 font-serif text-[16px] italic leading-relaxed text-ink-2">“{idea.hook}”</blockquote>}
        {idea.angle && (
          <div>
            <div className="eyebrow mb-0.5">The angle</div>
            <p className="text-[14px] leading-relaxed text-ink">{idea.angle}</p>
          </div>
        )}
        {!compact && (
          <div className="grid gap-3 sm:grid-cols-2">
            {idea.whyUntold && (
              <div>
                <div className="eyebrow mb-0.5">Why it&apos;s untold</div>
                <p className="text-[13px] leading-relaxed text-ink-2">{idea.whyUntold}</p>
              </div>
            )}
            {idea.whyItLands && (
              <div>
                <div className="eyebrow mb-0.5">Why it lands</div>
                <p className="text-[13px] leading-relaxed text-ink-2">{idea.whyItLands}</p>
              </div>
            )}
          </div>
        )}
        {(backing.stories.length > 0 || backing.sources.length > 0) && (
          <div>
            <div className="eyebrow mb-1">Research behind it</div>
            <ul className="space-y-1 text-[13px]">
              {backing.stories.map((s) => (
                <li key={s.id}>
                  <Link href={`/story/${s.id}`} className="text-ink-2 hover:text-ink hover:underline">{s.headline}</Link>
                  <span className="text-muted"> · {s.sourceCount} outlet{s.sourceCount === 1 ? "" : "s"}</span>
                </li>
              ))}
              {!compact &&
                backing.sources.map((s) => (
                  <li key={s.id} className="text-[12.5px]">
                    {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="text-muted hover:text-ink hover:underline">{s.title}</a> : <span className="text-muted">{s.title}</span>}
                    {s.publisher && <span className="text-muted"> — {s.publisher}</span>}
                  </li>
                ))}
            </ul>
          </div>
        )}
        {!compact && idea.openQuestions.length > 0 && (
          <div>
            <div className="eyebrow mb-1">To find out before making it</div>
            <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">{idea.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
          </div>
        )}
      </div>
    </article>
  );
}
