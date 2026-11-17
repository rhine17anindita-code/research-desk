"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { Icon } from "./Icon";
import { timeAgo } from "@/lib/format";
import type { RankedCluster } from "@/lib/ranking";

export function StoryCard({ story, signalLabels, rank, why: whyLine }: { story: RankedCluster; signalLabels: Record<string, string>; rank?: number; why?: { text: string; tone: string; type: string } | null }) {
  const router = useRouter();
  const [state, setState] = useState(story.state);
  const [rating, setRating] = useState(story.rating);
  const [gone, setGone] = useState(false);
  const [why, setWhy] = useState(false);
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function send(kind: string, rs: string[] = []) {
    setBusy(true);
    try {
      await api(`/api/stories/${story.id}/feedback`, "POST", { kind, reasons: rs });
      if (kind === "save") setState("saved");
      if (kind === "unsave" || kind === "restore") setState("new");
      if (kind === "interesting") setRating(1);
      if (kind === "uninteresting") setRating(-1);
      if (kind === "clear") setRating(0);
      if (kind === "dismiss") setGone(true);
      if (kind === "restore") setGone(true);
    } finally {
      setBusy(false);
    }
  }

  if (gone) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-dashed border-line px-4 py-3 text-[13px] text-muted">
        <span>{story.state === "dismissed" ? "Restored to your feed." : "Hidden from your feed."}</span>
        {story.state !== "dismissed" && (
          <button
            className="btn-ghost"
            onClick={async () => {
              await api(`/api/stories/${story.id}/feedback`, "POST", { kind: "restore" });
              setGone(false);
              router.refresh();
            }}
          >
            Undo
          </button>
        )}
      </div>
    );
  }

  const shownPublishers = story.publishers.slice(0, 3);
  const signals = story.score.signals;

  return (
    <article className="card group px-4 py-3.5 transition-shadow hover:shadow-[0_1px_0_0_var(--line-strong)] sm:px-5">
      <div className="flex items-start gap-3">
        {rank !== undefined && <div className="mt-0.5 hidden w-5 shrink-0 text-right font-serif text-[15px] text-muted sm:block">{rank}</div>}
        {story.image && (
          <Link href={`/story/${story.id}`} className="order-last hidden shrink-0 sm:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={story.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-[84px] w-[128px] rounded-md bg-surface-2 object-cover" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted">
            {story.isSample && <span className="rounded bg-warn-soft px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide text-warn">Sample · fictional</span>}
            <span>{shownPublishers.join(" · ")}{story.publishers.length > 3 ? ` +${story.publishers.length - 3}` : ""}</span>
            <span aria-hidden>·</span>
            <span>{timeAgo(story.lastUpdatedAt)}</span>
            {story.sourceCount > 1 && (
              <>
                <span aria-hidden>·</span>
                <span className="font-medium text-ink-2">{story.sourceCount} outlets</span>
              </>
            )}
            {story.inProjects > 0 && <span className="chip !py-0 text-[11px]">in project</span>}
          </div>
          <Link href={`/story/${story.id}`} className="block">
            <h2 className="font-serif text-[18px] font-semibold leading-snug tracking-[-0.005em] text-ink decoration-line-strong underline-offset-4 group-hover:underline">
              {story.headline}
            </h2>
          </Link>
          {story.summary && <p className="mt-1 line-clamp-2 text-[13.5px] leading-relaxed text-ink-2">{story.summary}</p>}
          {whyLine && (
            <p className="mt-1.5 line-clamp-3 rounded-lg bg-accent-soft/40 px-2.5 py-1.5 text-[12.5px] leading-snug text-ink-2">
              <span className="mr-1 font-semibold text-accent">{whyLine.type} ·</span>
              {whyLine.text}
            </p>
          )}

          {(signals.length > 0 || story.topQuestion) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {signals.slice(0, 4).map((s) => (
                <span key={s.signalId} className="chip border-accent/25 bg-accent-soft/60 text-accent" title={`Matched: ${s.matches.join(", ")}`}>
                  {signalLabels[s.signalId] ?? s.signalId}
                </span>
              ))}
            </div>
          )}
          {story.topQuestion && (
            <Link href={`/story/${story.id}`} className="mt-2 flex items-start gap-1.5 text-[13px] text-ink-2 hover:text-ink">
              <Icon name="question" size={15} className="mt-0.5 shrink-0 text-accent" />
              <span className="line-clamp-1">{story.topQuestion}</span>
              {story.questionCount > 1 && <span className="shrink-0 text-muted">+{story.questionCount - 1}</span>}
            </Link>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-0.5 text-muted">
            <button className={`btn-ghost ${state === "saved" ? "!text-accent" : ""}`} disabled={busy} onClick={() => send(state === "saved" ? "unsave" : "save", reasons)} title="Save for research">
              <Icon name="bookmark" size={15} /> {state === "saved" ? "Saved" : "Save"}
            </button>
            <div className="relative">
              <button className={`btn-ghost ${rating === 1 ? "!text-ok" : ""}`} disabled={busy} onClick={() => (rating === 1 ? send("clear") : setReasonsOpen((o) => !o))} title="More like this — tell it why">
                <Icon name="thumbUp" size={15} /> Interesting
              </button>
              {reasonsOpen && (
                <div className="absolute left-0 top-8 z-20 w-72 rounded-lg border border-line bg-surface p-3 shadow-lg">
                  <div className="eyebrow mb-2">Why is it worth investigating?</div>
                  <div className="flex flex-col gap-1">
                    {Object.entries(signalLabels).map(([id, label]) => (
                      <label key={id} className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
                        <input type="checkbox" checked={reasons.includes(id)} onChange={(e) => setReasons((r) => (e.target.checked ? [...r, id] : r.filter((x) => x !== id)))} />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button className="btn-ghost" onClick={() => setReasonsOpen(false)}>Cancel</button>
                    <button className="btn-primary" onClick={async () => { await send("interesting", reasons); setReasonsOpen(false); }}>
                      Save feedback
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button className={`btn-ghost ${rating === -1 ? "!text-bad" : ""}`} disabled={busy} onClick={() => send(rating === -1 ? "clear" : "uninteresting")} title="Fewer like this">
              <Icon name="thumbDown" size={15} /> Not for me
            </button>
            {story.state === "dismissed" ? (
              <button className="btn-ghost" disabled={busy} onClick={() => send("restore")}>Restore</button>
            ) : (
              <button className="btn-ghost" disabled={busy} onClick={() => send("dismiss")} title="Hide this story">
                <Icon name="x" size={15} /> Hide
              </button>
            )}
            <button className="btn-ghost ml-auto" onClick={() => setWhy((w) => !w)} aria-expanded={why}>
              Why this? <span className="tabular-nums text-ink-2">{story.score.total.toFixed(1)}</span>
            </button>
          </div>
          {why && (
            <div className="mt-2 rounded-md bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">
              <table className="w-full">
                <tbody>
                  {story.score.parts.map((p) => (
                    <tr key={p.label}>
                      <td className="py-0.5 pr-3">{p.label}</td>
                      <td className={`py-0.5 text-right tabular-nums ${p.value < 0 ? "text-bad" : ""}`}>{p.value > 0 ? "+" : ""}{p.value.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {signals.length > 0 && (
                <p className="mt-1.5 text-muted">Cues found: {signals.map((s) => `${signalLabels[s.signalId] ?? s.signalId} (“${s.matches.join("”, “")}”)`).join("; ")}</p>
              )}
              <p className="mt-1 text-muted">Ranking is local and rule-based; no AI was used. Tune it in Settings → Personalisation.</p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
