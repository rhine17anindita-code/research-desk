"use client";

import { useState } from "react";
import { AiButton } from "./AiButton";
import { InlineIdeas } from "./studio/InlineIdeas";
import type { Lens, StoryNote } from "@/lib/ideation/lens";

const TONE: Record<string, string> = { new: "bg-ok-soft text-ok", developing: "bg-accent-soft text-accent", familiar: "bg-warn-soft text-warn" };

/** Why a story could matter and what you could make from it: free signals + the editor's note. */
export function StoryLens({ clusterId, lens, note: initial }: { clusterId: string; lens: Lens; note: StoryNote | null }) {
  const [note, setNote] = useState(initial);
  const [ideas, setIdeas] = useState(false);
  return (
    <div className="space-y-3 rounded-2xl border border-accent/25 bg-accent-soft/30 p-3.5">
      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
        <span className="font-semibold uppercase tracking-wide text-accent">Content lens</span>
        <span className="chip !text-[11px]">{lens.type}</span>
        <span className={`rounded-full px-2 py-0.5 font-medium ${TONE[lens.freshness.tone]}`}>{lens.freshness.label}</span>
        <span className="text-muted">{lens.momentum}</span>
      </div>

      {note ? (
        <div className="space-y-2 text-[13px] leading-relaxed">
          <p className="text-ink"><b>Why it matters:</b> {note.why_it_matters}</p>
          <p className="text-ink-2"><b>The real story:</b> {note.real_story}</p>
          <p className="text-ink-2"><b>What&apos;s new:</b> {note.whats_new}</p>
        </div>
      ) : (
        <ul className="list-disc space-y-0.5 pl-4 text-[13px] text-ink-2">
          {lens.whyItCouldMatter.map((w) => <li key={w}>{w}</li>)}
          {lens.bangladesh && <li>{lens.bangladesh}</li>}
        </ul>
      )}

      {(lens.who.length > 0 || lens.numbers.length > 0) && (
        <div className="flex flex-wrap gap-1.5 text-[11.5px]">
          {lens.who.map((w) => <span key={w} className="chip !text-[11px]">{w}</span>)}
          {lens.numbers.map((n) => <span key={n} className="chip border-ok/30 !text-[11px] text-ok">{n}</span>)}
        </div>
      )}

      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">What you could make</div>
        <ul className="space-y-1 text-[13px]">
          {(note?.options.length ? note.options.map((o) => ({ format: o.format, idea: o.title, hook: o.hook })) : lens.options.map((o) => ({ ...o, hook: "" }))).map((o, i) => (
            <li key={i}>
              <span className="chip mr-1 !text-[10.5px]">{o.format}</span>
              <span className="text-ink">{o.idea}</span>
              {o.hook && <div className="pl-1 text-[12px] italic text-muted">“{o.hook}”</div>}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">What viewers will wonder</div>
        <ul className="space-y-1 text-[12.5px]">
          {(note?.viewer_questions.length ? note.viewer_questions : lens.questions.map((q) => ({ question: q, short_answer: "" }))).map((q, i) => (
            <li key={i}>
              <span className="text-ink">{q.question}</span>
              {q.short_answer && <span className="text-muted"> — {q.short_answer}</span>}
            </li>
          ))}
        </ul>
      </div>

      {note?.careful && <p className="rounded-lg bg-warn-soft/60 px-2.5 py-1.5 text-[12px] text-ink-2"><b>Careful:</b> {note.careful}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {!note && (
          <AiButton size="sm" label="Write the editor's note" endpoint={`/api/stories/${clusterId}/note`} confirm="auto" runningLabel="Reading the coverage…" onResult={(r) => setNote(r.data as StoryNote)} />
        )}
        <button className="btn !py-1 !text-[12.5px] !text-accent" onClick={() => setIdeas((o) => !o)}>{ideas ? "Close" : "Full ideas from this"}</button>
        {!note && <span className="text-[11px] text-muted">Notes are written automatically for the day&apos;s top stories.</span>}
      </div>
      {ideas && <InlineIdeas payload={{ clusterIds: [clusterId] }} label="Ideas from this story" count={4} />}
    </div>
  );
}
