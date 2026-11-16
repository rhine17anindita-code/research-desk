"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { AiButton } from "../AiButton";
import { ClaimKind, OriginBadge, StateBadge } from "./Badges";
import type { QuestionDetail } from "@/lib/research/question-detail";
import { fmtDate } from "@/lib/format";
import type { Source } from "@/lib/types";

type DetailAnswer = QuestionDetail["answers"][number];

export function Cite({ ids, index, sources }: { ids: string[]; index: Map<string, number>; sources: Map<string, Source> }) {
  if (!ids.length) return null;
  return (
    <span className="ml-1 inline-flex flex-wrap gap-0.5 align-baseline">
      {ids.map((id) => {
        const s = sources.get(id);
        const n = index.get(id);
        return (
          <a
            key={id}
            href={s?.url ?? `/library/source/${id}`}
            target={s?.url ? "_blank" : undefined}
            rel="noreferrer"
            title={s ? `${s.title}${s.publisher ? ` — ${s.publisher}` : ""}${s.publishedAt ? ` (${s.publishedAt.slice(0, 10)})` : ""}` : "Source"}
            className="inline-flex min-w-[18px] justify-center rounded border border-accent/30 bg-accent-soft px-1 text-[10.5px] font-semibold leading-[16px] text-accent no-underline hover:border-accent"
          >
            {n ?? "↗"}
          </a>
        );
      })}
    </span>
  );
}

function AnswerBody({ a, index, sources }: { a: DetailAnswer; index: Map<string, number>; sources: Map<string, Source> }) {
  const levelName = a.level === 0 ? "Your finding" : a.level === 1 ? "Quick context" : a.level === 2 ? "Source exploration" : "Deep research brief";
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px] text-muted">
        <StateBadge state={a.state} />
        <OriginBadge origin={a.origin} />
        <span>{levelName}</span>
        <span>·</span>
        <span>{fmtDate(a.createdAt, true)}</span>
        {a.model && <span className="text-muted">· {a.model}</span>}
      </div>
      <p className="text-[14.5px] leading-relaxed text-ink">{a.summary}</p>

      {a.brief ? (
        <div className="mt-3 space-y-3">
          {a.brief.findings.map((f, i) => (
            <div key={i}>
              <h4 className="text-[13.5px] font-semibold text-ink">
                {f.heading}
                {f.sourceIds.length === 0 && <span className="ml-2 text-[11px] font-normal text-bad">no source</span>}
              </h4>
              <p className="text-[13.5px] leading-relaxed text-ink-2">
                {f.detail}
                <Cite ids={f.sourceIds} index={index} sources={sources} />
              </p>
            </div>
          ))}
          {a.brief.competingExplanations.length > 0 && (
            <div>
              <div className="eyebrow mb-1.5">Competing explanations</div>
              <div className="space-y-2">
                {a.brief.competingExplanations.map((c, i) => (
                  <div key={i} className="rounded-md border border-line p-2.5 text-[13px]">
                    <div className="font-medium text-ink">
                      {c.explanation}
                      <Cite ids={c.sourceIds} index={index} sources={sources} />
                    </div>
                    <div className="mt-1 grid gap-2 text-ink-2 sm:grid-cols-2">
                      <div><span className="text-[11px] font-semibold uppercase tracking-wide text-ok">For</span> {c.evidenceFor}</div>
                      <div><span className="text-[11px] font-semibold uppercase tracking-wide text-bad">Against</span> {c.evidenceAgainst}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {a.brief.angles.length > 0 && (
            <div>
              <div className="eyebrow mb-1">Editorial angles (AI suggestions)</div>
              <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">{a.brief.angles.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          )}
        </div>
      ) : (
        a.points.length > 0 && (
          <ul className="mt-2.5 space-y-1.5">
            {a.points.map((p, i) => (
              <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed">
                <span className="mt-[3px] w-[88px] shrink-0 text-right"><ClaimKind kind={p.kind} /></span>
                <span className={`text-ink-2 ${p.unsupported ? "decoration-bad/50 decoration-dotted underline underline-offset-4" : ""}`}>
                  {p.text}
                  <Cite ids={p.sourceIds} index={index} sources={sources} />
                  {p.unsupported && <span className="ml-1.5 text-[11px] text-bad" title="The model presented this as factual but cited no supplied source. Treat as unverified.">unsourced</span>}
                </span>
              </li>
            ))}
          </ul>
        )
      )}

      {a.caveats.length > 0 && (
        <div className="mt-3">
          <div className="eyebrow mb-1">Qualifications</div>
          <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">{a.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
      {a.nextSteps.length > 0 && (
        <div className="mt-3">
          <div className="eyebrow mb-1">{a.brief ? "Gaps to close" : "To go further"}</div>
          <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">{a.nextSteps.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

/** Center-column content of an expanded question: answers, the user's own finding, follow-ups. */
export function AnswerView({ detail, reload, compact = false }: { detail: QuestionDetail; reload: () => void; compact?: boolean }) {
  const [showOld, setShowOld] = useState(false);
  const [finding, setFinding] = useState("");
  const [findingState, setFindingState] = useState("");
  const [follow, setFollow] = useState("");
  const current = detail.answers.filter((a) => !a.superseded);
  const old = detail.answers.filter((a) => a.superseded);
  const index = new Map(detail.sources.map((s, i) => [s.id, i + 1]));
  const sources = new Map(detail.sources.map((s) => [s.id, s as Source]));
  const q = detail.question;

  return (
    <div className="space-y-4">
      {current.length === 0 ? (
        <div className="rounded-md bg-surface-2 px-3.5 py-3 text-[13px] text-ink-2">
          <p className="mb-2">No answer yet. Choose how deep to go — each level is a deliberate step:</p>
          <div className="flex flex-wrap items-start gap-2">
            <AiButton label="Quick context" title="Level 1: a short answer from the story's coverage and any sources you attached." endpoint={`/api/questions/${q.id}/answer`} payload={{ level: 1 }} onResult={reload} />
            <AiButton label="Explore sources & answer" title="Level 2: searches free research indexes and news archives (no AI), then answers from what was found." endpoint={`/api/questions/${q.id}/answer`} payload={{ level: 2 }} confirm="always" runningLabel="Searching and reading…" onResult={reload} />
          </div>
          <p className="mt-2 text-[12px] text-muted">Prefer to look first? Use <b>Find sources</b> in the evidence panel — it is free and uses no AI.</p>
        </div>
      ) : (
        current.map((a) => (
          <div key={a.id} className={`rounded-md border-l-2 pl-3.5 ${a.origin === "ai" ? "border-ai/40" : "border-ink-2/40"}`}>
            <AnswerBody a={a} index={index} sources={sources} />
            <div className="mt-2.5 flex flex-wrap items-center gap-1">
              {a.origin === "ai" && (
                <>
                  <AiButton label="Regenerate" variant="ghost" size="sm" endpoint={`/api/questions/${q.id}/answer`} payload={{ level: a.level === 2 ? 2 : 1, regenerate: true, explore: false }} confirm="always" onResult={reload} />
                  {a.level < 2 && <AiButton label="Go deeper: explore sources" variant="ghost" size="sm" endpoint={`/api/questions/${q.id}/answer`} payload={{ level: 2 }} confirm="always" runningLabel="Searching and reading…" onResult={reload} />}
                </>
              )}
              <button className="btn-ghost !text-[12px]" onClick={async () => { await api(`/api/answers/${a.id}`, "PATCH", { superseded: true }); reload(); }}>
                Mark outdated
              </button>
            </div>
          </div>
        ))
      )}

      {old.length > 0 && (
        <div>
          <button className="btn-ghost !px-0 !text-[12px]" onClick={() => setShowOld((s) => !s)}>
            <Icon name={showOld ? "up" : "down"} size={13} /> {old.length} earlier answer{old.length === 1 ? "" : "s"}
          </button>
          {showOld && (
            <div className="mt-2 space-y-3 opacity-80">
              {old.map((a) => (
                <div key={a.id} className="rounded-md border border-dashed border-line p-3">
                  <AnswerBody a={a} index={index} sources={sources} />
                  <div className="mt-2 flex gap-1">
                    <button className="btn-ghost !text-[12px]" onClick={async () => { await api(`/api/answers/${a.id}`, "PATCH", { superseded: false }); reload(); }}>Restore</button>
                    <button className="btn-ghost !text-[12px]" onClick={async () => { if (confirm("Delete this answer permanently?")) { await api(`/api/answers/${a.id}`, "DELETE"); reload(); } }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!compact && (
        <div className="grid gap-4 2xl:grid-cols-2">
          <div>
            <div className="eyebrow mb-1.5">Record your own finding</div>
            <textarea className="input min-h-[70px] text-[13px]" value={finding} onChange={(e) => setFinding(e.target.value)} placeholder="What you established, and how. Attached sources will be linked as its evidence." />
            <div className="mt-1.5 flex gap-2">
              <select className="input !w-auto !py-1 text-[12px]" value={findingState} onChange={(e) => setFindingState(e.target.value)}>
                <option value="">Keep status</option>
                <option value="established">Established</option>
                <option value="partial">Partial</option>
                <option value="contested">Contested</option>
                <option value="needs-investigation">Needs investigation</option>
                <option value="open">Open</option>
              </select>
              <button
                className="btn"
                disabled={!finding.trim()}
                onClick={async () => {
                  await api(`/api/questions/${q.id}/user-answer`, "POST", {
                    summary: finding,
                    state: findingState || undefined,
                    sourceIds: detail.sources.filter((s) => s.status === "attached").map((s) => s.id),
                  });
                  setFinding("");
                  reload();
                }}
              >
                Save finding
              </button>
            </div>
          </div>
          <div>
            <div className="eyebrow mb-1.5">Follow-up questions</div>
            {detail.followUps.length > 0 && (
              <ul className="mb-2 space-y-1">
                {detail.followUps.map((f) => (
                  <li key={f.id} className="flex items-start gap-1.5 text-[13px]">
                    <Icon name="question" size={14} className="mt-0.5 shrink-0 text-accent" />
                    <Link href={`/question/${f.id}`} className="text-ink-2 hover:text-ink hover:underline">{f.text}</Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input className="input text-[13px]" value={follow} onChange={(e) => setFollow(e.target.value)} placeholder="Ask a follow-up…" onKeyDown={async (e) => {
                if (e.key === "Enter" && follow.trim()) {
                  await api("/api/questions", "POST", { text: follow, parentId: q.id, clusterId: q.clusterId ?? undefined, projectId: q.projectId ?? undefined });
                  setFollow("");
                  reload();
                }
              }} />
              <button className="btn" disabled={!follow.trim()} onClick={async () => {
                await api("/api/questions", "POST", { text: follow, parentId: q.id, clusterId: q.clusterId ?? undefined, projectId: q.projectId ?? undefined });
                setFollow("");
                reload();
              }}>Add</button>
            </div>
          </div>
        </div>
      )}
      {!compact && (
        <div className="flex justify-end">
          <Link href={`/question/${q.id}`} className="text-[12.5px] text-accent hover:underline">Open full question page →</Link>
        </div>
      )}
    </div>
  );
}
