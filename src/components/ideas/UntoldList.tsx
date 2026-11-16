"use client";

import Link from "next/link";
import { useState } from "react";
import { GeneratePanel } from "./GeneratePanel";
import { timeAgo } from "@/lib/format";
import type { Opportunity } from "@/lib/ideation/opportunities";

export function UntoldList({ opps }: { opps: Opportunity[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  if (!opps.length) return <div className="card px-6 py-8 text-center text-[13.5px] text-muted">Nothing stands out in this window. Refresh feeds or widen the time range.</div>;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <ul className="space-y-2">
        {opps.map((o) => (
          <li key={o.clusterId} className={`card flex gap-3 px-4 py-3 ${picked.includes(o.clusterId) ? "border-accent/60" : ""}`}>
            <input
              type="checkbox"
              className="mt-1.5"
              checked={picked.includes(o.clusterId)}
              onChange={(e) => setPicked((p) => (e.target.checked ? [...p, o.clusterId].slice(-8) : p.filter((x) => x !== o.clusterId)))}
              aria-label="Use for ideas"
            />
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted">
                <span className="font-semibold tabular-nums text-accent">{o.score}</span>
                <span>{o.publishers.slice(0, 3).join(" · ")}{o.publishers.length > 3 ? ` +${o.publishers.length - 3}` : ""}</span>
                <span>· {timeAgo(o.lastUpdatedAt)}</span>
              </div>
              <Link href={`/story/${o.clusterId}`} className="font-serif text-[16.5px] font-semibold leading-snug hover:underline">{o.headline}</Link>
              <ul className="mt-1 space-y-0.5 text-[12.5px] text-ink-2">
                {o.reasons.map((r, i) => <li key={i}>· {r}</li>)}
              </ul>
              {o.openQuestions.length > 0 && (
                <div className="mt-1 line-clamp-2 text-[12px] text-muted">
                  Open: {o.openQuestions.slice(0, 2).map((q) => q.text).join(" · ")}{o.openQuestions.length > 2 ? ` (+${o.openQuestions.length - 2} more)` : ""}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="mb-2 text-[13px] text-ink-2">
          {picked.length ? `${picked.length} stor${picked.length === 1 ? "y" : "ies"} selected — ideas will be built from these (and can connect them).` : "Select up to 8 stories to build ideas from, or generate from the top ones automatically."}
        </div>
        <GeneratePanel clusterIds={picked.length ? picked : undefined} label={picked.length ? "Generate ideas from selected" : undefined} />
      </aside>
    </div>
  );
}
