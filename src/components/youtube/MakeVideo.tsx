"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { YtIdea } from "@/lib/youtube/producer";

const KIND: Record<YtIdea["kind"], [string, string]> = {
  missed: ["Missed angle", "bg-ok-soft text-ok"],
  proven: ["Proven topic", "bg-accent-soft text-accent"],
  story: ["Big story", "bg-surface-2 text-ink-2"],
  series: ["Series episode", "bg-ai-soft text-ai"],
  evergreen: ["Evergreen", "bg-ai-soft text-ai"],
};
const STEP_LABEL = ["brief", "research", "outline", "script", "package"] as const;

export interface ProductionRow { id: string; title: string; stage: string; publishDate: string | null; updatedAt: string; steps: Record<(typeof STEP_LABEL)[number], boolean> }

/** Pick what to make; the producer does the rest. */
export function MakeVideo({ ytChannelId, channelName, productions }: { ytChannelId: string; channelName: string; productions: ProductionRow[] }) {
  const router = useRouter();
  const [ideas, setIdeas] = useState<YtIdea[] | null>(null);
  const [kind, setKind] = useState<"all" | YtIdea["kind"]>("all");
  const [own, setOwn] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    setIdeas(null);
    api<{ ideas: YtIdea[] }>(`/api/youtube/ideas?yt=${ytChannelId}`).then((r) => setIdeas(r.ideas)).catch(() => setIdeas([]));
  }, [ytChannelId]);
  const produce = async (title: string, storyId?: string | null, n?: string, key?: string) => {
    setBusy(key ?? "own");
    try {
      const r = await api<{ projectId: string }>("/api/youtube/produce", "POST", { ytChannelId, title, storyId, notes: n });
      router.push(`/youtube/make/${r.projectId}`);
    } finally {
      setBusy(null);
    }
  };
  const list = (ideas ?? []).filter((i) => kind === "all" || i.kind === kind);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-3">
        <section className="card px-4 py-3">
          <h2 className="font-serif text-[18px] font-semibold">Make a video for {channelName}</h2>
          <p className="text-[12.5px] text-muted">Pick an idea below or bring your own. The producer then writes the strategy (angle, titles, thumbnail, hook), researches it, outlines and scripts it in your voice, and packages it — you read it on camera.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input className="input flex-1 text-[13px]" value={own} onChange={(e) => setOwn(e.target.value)} placeholder="Your own idea: e.g. Why Bangladesh's rice prices jump every year" />
            <input className="input text-[13px] sm:w-64" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any angle or notes (optional)" />
            <button className="btn-primary" disabled={!own.trim() || !!busy} onClick={() => produce(own, null, notes)}>{busy === "own" ? "Starting…" : "Produce this"}</button>
          </div>
        </section>
        <div className="flex flex-wrap gap-1">
          <button className={kind === "all" ? "chip-accent" : "chip"} onClick={() => setKind("all")}>All ideas</button>
          {(Object.keys(KIND) as YtIdea["kind"][]).map((k) => <button key={k} className={kind === k ? "chip-accent" : "chip"} onClick={() => setKind(k)}>{KIND[k][0]}</button>)}
        </div>
        {ideas === null && <p className="text-[12.5px] text-muted">Finding ideas with evidence…</p>}
        <div className="grid gap-2 md:grid-cols-2">
          {list.map((i) => (
            <article key={i.key} className="card flex flex-col px-3.5 py-3">
              <span className={`mb-1 w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND[i.kind][1]}`}>{KIND[i.kind][0]}</span>
              <h3 className="text-[14px] font-semibold leading-snug text-ink">{i.title}</h3>
              <p className="mt-1 text-[12px] text-ink-2">{i.why}</p>
              <p className="text-[11.5px] text-muted">{i.evidence}</p>
              <div className="mt-auto flex items-center gap-3 pt-2 text-[12.5px]">
                <button className="btn-primary !py-1 !text-[12.5px]" disabled={!!busy} onClick={() => produce(i.title, i.storyId ?? null, undefined, i.key)}>{busy === i.key ? "Starting…" : "Produce this"}</button>
                {i.storyId && <Link href={`/story/${i.storyId}`} className="text-accent hover:underline">The story</Link>}
              </div>
            </article>
          ))}
          {ideas && !list.length && <p className="text-[12.5px] text-muted">No ideas here yet — track competitors (Competitors tab) and refresh the news for more.</p>}
        </div>
      </div>
      <aside className="space-y-2">
        <h2 className="font-serif text-[17px] font-semibold">In production ({productions.length})</h2>
        {productions.map((p) => {
          const done = STEP_LABEL.filter((s) => p.steps[s]).length;
          return (
            <Link key={p.id} href={`/youtube/make/${p.id}`} className="card block px-3 py-2.5 hover:border-accent/40">
              <div className="line-clamp-2 text-[13px] font-medium text-ink">{p.title}</div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${(done / 5) * 100}%` }} /></div>
              <div className="mt-1 text-[11px] text-muted">{done === 5 ? "Ready to record" : `${done}/5 steps`}{p.publishDate ? ` · out ${p.publishDate}` : ""}</div>
            </Link>
          );
        })}
        {!productions.length && <p className="text-[12.5px] text-muted">Nothing yet — pick an idea.</p>}
      </aside>
    </div>
  );
}
