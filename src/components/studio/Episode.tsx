"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "../Icon";
import { AiButton } from "../AiButton";
import { InlineIdeas, IdeaQuickActions } from "./InlineIdeas";
import { IdeaCard, type BackingInfo } from "../ideas/IdeaCard";
import type { Moment } from "@/lib/transcripts";
import type { Mined } from "@/lib/ideation/talk-mine";
import type { Idea } from "@/lib/ideation/repo";

const clock = (sec: number) => {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(s % 60).padStart(2, "0")}`;
};

/** The moments worth a look, found for free by scanning the transcript. */
export function EpisodeMoments({ articleId, moments }: { articleId: string; moments: Moment[] }) {
  return (
    <section className="card px-4 py-3">
      <h2 className="font-serif text-[18px] font-semibold">Moments worth a look</h2>
      <p className="mb-2 text-[12.5px] text-muted">Found for free: parts that touch your focus, Bangladesh, numbers, or “here&apos;s what&apos;s really going on” talk. Leads, not checked facts.</p>
      {moments.length ? (
        <ul className="divide-y divide-line">{moments.map((m) => <MomentRow key={m.start} articleId={articleId} m={m} />)}</ul>
      ) : (
        <p className="text-[12.5px] text-muted">Nothing stood out in the free scan. “Read the whole episode” below can still find things.</p>
      )}
    </section>
  );
}

function MomentRow({ articleId, m }: { articleId: string; m: Moment }) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-baseline gap-2">
        <a href={m.url} target="_blank" rel="noreferrer" className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[12px] font-semibold text-accent hover:underline">▶ {clock(m.start)}</a>
        {m.reasons.slice(0, 3).map((r) => <span key={r} className="chip !text-[11px]">{r}</span>)}
      </div>
      <p className={`mt-1 text-[13px] leading-relaxed text-ink-2 ${full ? "" : "line-clamp-3"}`}>{m.text}</p>
      <div className="mt-1 flex gap-3">
        <button className="btn-ghost !px-0 !text-[12px]" onClick={() => setFull((f) => !f)}>{full ? "Less" : "Read all of it"}</button>
        <button className="btn-ghost !px-0 !text-[12px] !text-accent" onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? "up" : "bulb"} size={12} /> {open ? "Close" : "Ideas from this moment"}
        </button>
      </div>
      {open && <div className="mt-2"><InlineIdeas payload={{ talkMoment: { articleId, start: m.start } }} label="Ideas from this moment" count={3} /></div>}
    </li>
  );
}

const VERDICT: Record<string, [string, string]> = {
  check: ["Check first", "bg-warn-soft text-warn"],
  challenge: ["Challenge it", "bg-bad-soft text-bad"],
  solid: ["Solid", "bg-ok-soft text-ok"],
};

/** The AI read of a whole episode: summary, claims, quotes, untold details, and ideas saved to the Studio. */
export function MineEpisode({ articleId, mined, ideas, backing }: { articleId: string; mined: Mined | null; ideas: Idea[]; backing: Record<string, BackingInfo> }) {
  const router = useRouter();
  const seek = (at: string) => {
    const p = at.split(":").map(Number);
    return p.some(Number.isNaN) ? null : p.reduce((a, n) => a * 60 + n, 0);
  };
  const link = (at: string) => {
    const s = seek(at);
    return mined && s != null ? `https://www.youtube.com/watch?v=${mined.videoId}&t=${s}s` : undefined;
  };
  const At = ({ at }: { at: string }) => (
    <a href={link(at)} target="_blank" rel="noreferrer" className="mr-1.5 font-mono text-[11.5px] text-accent hover:underline">{at}</a>
  );
  return (
    <section className="card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-serif text-[18px] font-semibold">Read the whole episode</h2>
          <p className="text-[12.5px] text-muted">AI goes through the conversation: claims to check or challenge, quotes to clip, things the news hasn&apos;t covered, and ideas that go straight into your Studio.</p>
        </div>
        <AiButton
          label={mined ? "Read it again" : "Read the whole episode"}
          endpoint={`/api/talk/${articleId}/mine`}
          payload={{ regenerate: !!mined }}
          confirm="always"
          runningLabel="Reading the episode…"
          onResult={() => router.refresh()}
        />
      </div>
      {mined && (
        <div className="mt-3 space-y-4 text-[13px]">
          <p className="leading-relaxed text-ink-2">{mined.summary}{mined.partial ? " (Long episode: the strongest parts were read.)" : ""}</p>
          {mined.claims.length > 0 && (
            <div>
              <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted">Claims</h3>
              <ul className="space-y-1.5">
                {mined.claims.map((c, i) => (
                  <li key={i}>
                    <span className={`mr-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${VERDICT[c.verdict]?.[1] ?? "chip"}`}>{VERDICT[c.verdict]?.[0] ?? c.verdict}</span>
                    <At at={c.at} />
                    <span className="text-ink">{c.claim}</span> <span className="text-muted">— {c.who}. {c.why}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {mined.quotes.length > 0 && (
            <div>
              <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted">Lines to clip or react to</h3>
              <ul className="space-y-1">
                {mined.quotes.map((q, i) => (
                  <li key={i}><At at={q.at} /><span className="font-serif text-[14px] text-ink">“{q.quote}”</span> <span className="text-muted">— {q.who}</span></li>
                ))}
              </ul>
            </div>
          )}
          {mined.untold.length > 0 && (
            <div>
              <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted">Not in the news</h3>
              <ul className="space-y-1">
                {mined.untold.map((u, i) => <li key={i}><At at={u.at} /><span className="text-ink">{u.what}</span> <span className="text-muted">— {u.why_it_matters}</span></li>)}
              </ul>
            </div>
          )}
          {ideas.length > 0 && (
            <div>
              <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted">Ideas from this episode (also in your Studio)</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {ideas.map((i) => (
                  <div key={i.id} className="space-y-1.5">
                    <IdeaCard idea={i} backing={backing[i.id] ?? { stories: [], sources: [] }} compact />
                    <IdeaQuickActions idea={i} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
