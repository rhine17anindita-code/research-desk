"use client";

import Link from "next/link";
import { useState } from "react";
import type { GuideTask } from "@/lib/guide";

const COST = { free: ["free", "bg-ok-soft text-ok"], ai: ["AI", "bg-ai-soft text-ai"], mixed: ["free + optional AI", "bg-surface-2 text-ink-2"] } as const;

/** "I want to…" — type a few words and see where to go. */
export function GuideFinder({ tasks }: { tasks: GuideTask[] }) {
  const [q, setQ] = useState("");
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const list = words.length
    ? tasks
        .map((t) => ({ t, s: words.filter((w) => `${t.want} ${t.go} ${t.how} ${t.tags}`.toLowerCase().includes(w)).length }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.t)
    : tasks;
  return (
    <section>
      <input className="input text-[14px]" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="I want to… (e.g. breaking news, solutions, script length, sponsors, transcript)" />
      <h2 className="mb-2 mt-4 font-serif text-[20px] font-semibold">{words.length ? `${list.length} match${list.length === 1 ? "" : "es"}` : "I want to…"}</h2>
      <ul className="grid gap-2 md:grid-cols-2">
        {list.map((t) => (
          <li key={t.want}>
            <Link href={t.href} className="card block h-full px-3.5 py-2.5 hover:border-accent/40">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[13.5px] font-semibold text-ink">{t.want}</span>
                <span className={`shrink-0 rounded-full px-1.5 py-px text-[10.5px] font-semibold ${COST[t.cost][1]}`}>{COST[t.cost][0]}</span>
              </div>
              <div className="text-[12.5px] font-medium text-accent">→ {t.go}</div>
              <p className="text-[12px] text-ink-2">{t.how}</p>
            </Link>
          </li>
        ))}
        {!list.length && <li className="text-[13px] text-muted">Nothing matched — try other words, or press ⌘K to search everything.</li>}
      </ul>
    </section>
  );
}
