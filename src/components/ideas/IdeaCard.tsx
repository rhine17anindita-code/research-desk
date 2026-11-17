"use client";

import Link from "next/link";
import { useState } from "react";
import { ANGLE_TYPES, FORMAT_BY_ID } from "@/lib/ideation/formats";
import type { Idea } from "@/lib/ideation/repo";
import { MediaPanel } from "../MediaPanel";

export interface BackingInfo {
  stories: { id: string; headline: string; sourceCount: number }[];
  sources: { id: string; title: string; publisher: string | null; url: string | null }[];
}

const KIND_LABEL: Record<string, string> = { news: "From the news", trend: "Riding a trend", history: "History", archive: "Archive", statement: "A statement", culture: "Culture", inspiration: "From your inspiration", pitch: "Your idea", talk: "From a talk show",
  research: "From your research", evergreen: "Evergreen" };

export function FormatChip({ format }: { format: string }) {
  const f = FORMAT_BY_ID[format];
  return (
    <span className={`chip ${f?.medium === "written" ? "border-warn/30 text-warn" : "border-accent/30 text-accent"}`} title={f?.craft}>
      {f?.label ?? format} <span className="opacity-60">· {f?.platform}</span>
    </span>
  );
}

function Score({ label, n }: { label: string; n: number }) {
  return (
    <div className="text-center" title={`${label}: ${n}/10`}>
      <div className={`font-serif text-[17px] font-semibold tabular-nums ${n >= 8 ? "text-ok" : n >= 6 ? "text-ink" : "text-muted"}`}>{n}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

/** Full idea card: packaging first, then the angle, why it works, and the research behind it. */
export function IdeaCard({ idea, backing, compact = false }: { idea: Idea; backing: BackingInfo; compact?: boolean }) {
  const [showMore, setShowMore] = useState(!compact);
  const p = idea.packaging;
  return (
    <article className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface-2/60 px-5 py-2 text-[11.5px]">
        <FormatChip format={idea.format} />
        {idea.sourceKind && <span className="chip">{KIND_LABEL[idea.sourceKind] ?? idea.sourceKind}</span>}
        {idea.angleType && <span className="chip" title={ANGLE_TYPES[idea.angleType]}>{ANGLE_TYPES[idea.angleType]?.split(" — ")[0] ?? idea.angleType}</span>}
        {idea.timeliness && <span className="chip">{idea.timeliness}</span>}
        {idea.origin === "ai" && <span className="ml-auto rounded bg-ai-soft px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide text-ai">AI idea</span>}
        {idea.origin === "user" && <span className="ml-auto rounded bg-surface px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide text-ink-2">Your idea</span>}
      </div>
      <div className="space-y-3.5 px-5 py-4">
        <div className="flex items-start gap-4">
          <h2 className={`min-w-0 flex-1 font-serif font-semibold leading-snug tracking-tight text-ink ${compact ? "text-[18px]" : "text-[23px]"}`}>
            {idea.origin === "user" ? <Link href={`/ideas/${idea.id}`} className="hover:underline">{idea.title}</Link> : idea.title}
          </h2>
          {p?.scores && !compact && (
            <div className="grid shrink-0 grid-cols-4 gap-2.5 rounded-md border border-line px-2.5 py-1.5">
              <Score label="Hook" n={p.scores.hook} />
              <Score label="Reach" n={p.scores.massAppeal} />
              <Score label="Fresh" n={p.scores.novelty} />
              <Score label="Proof" n={p.scores.evidence} />
            </div>
          )}
        </div>
        {p && p.titles.length > 0 && (
          <div className="text-[12.5px] text-muted">
            Or: {p.titles.filter((t) => t !== idea.title).slice(0, 2).map((t, i) => <span key={i} className="mr-2 text-ink-2">“{t}”</span>)}
          </div>
        )}
        {(p?.firstSeconds || idea.hook) && (
          <blockquote className="border-l-2 border-accent pl-3 font-serif text-[16px] italic leading-relaxed text-ink-2">
            <span className="mr-1 text-[10.5px] font-semibold not-italic uppercase tracking-wide text-accent">Opens with</span>“{p?.firstSeconds || idea.hook}”
          </blockquote>
        )}
        {p?.thumbnail && (
          <p className="text-[13px] text-ink-2"><span className="eyebrow mr-1.5">Thumbnail</span>{p.thumbnail}</p>
        )}
        {idea.angle && (
          <div>
            <div className="eyebrow mb-0.5">The angle</div>
            <p className="text-[14px] leading-relaxed text-ink">{idea.angle}</p>
          </div>
        )}
        {showMore && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {idea.whyUntold && (
                <div>
                  <div className="eyebrow mb-0.5">Why nobody&apos;s done it</div>
                  <p className="text-[13px] leading-relaxed text-ink-2">{idea.whyUntold}</p>
                </div>
              )}
              {(idea.whyItLands || p?.whoShares) && (
                <div>
                  <div className="eyebrow mb-0.5">Why it travels</div>
                  <p className="text-[13px] leading-relaxed text-ink-2">{idea.whyItLands}{p?.whoShares ? ` Shared by: ${p.whoShares}.` : ""}</p>
                </div>
              )}
            </div>
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
                  {backing.sources.map((s) => (
                    <li key={s.id} className="text-[12.5px]">
                      {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="text-muted hover:text-ink hover:underline">{s.title}</a> : <span className="text-muted">{s.title}</span>}
                      {s.publisher && <span className="text-muted"> — {s.publisher}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {idea.openQuestions.length > 0 && (
              <div>
                <div className="eyebrow mb-1">Check before making it</div>
                <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">{idea.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
              </div>
            )}
            <MediaPanel initialQuery={(backing.stories[0]?.headline ?? idea.title).split(/[:.?!]/)[0].split(" ").slice(0, 7).join(" ")} />
          </>
        )}
        {compact && (
          <button className="btn-ghost !px-0 !text-[12px]" onClick={() => setShowMore((s) => !s)}>
            {showMore ? "Less" : "Why it works, research & visuals"}
          </button>
        )}
      </div>
    </article>
  );
}
