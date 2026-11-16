"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { AiButton } from "../AiButton";
import { FormatChip } from "../ideas/IdeaCard";
import { MediaPanel } from "../MediaPanel";
import type { Idea } from "@/lib/ideation/repo";

/** Your own idea: expand it, write a proposal, develop it into a project. */
export function PitchCard({ initial }: { initial: Idea }) {
  const router = useRouter();
  const [idea, setIdea] = useState(initial);
  const [recipient, setRecipient] = useState("");
  const [notes, setNotes] = useState("");
  const ex = idea.expansion;
  const p = idea.packaging;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FormatChip format={idea.format} />
        <Link href={`/ideas/${idea.id}`} className="text-[12px] text-accent hover:underline">Open full page</Link>
      </div>
      <div>
        <h3 className="font-serif text-[20px] font-semibold leading-snug">{p?.titles[0] ?? idea.title}</h3>
        {p && p.titles.length > 1 && <p className="mt-0.5 text-[12.5px] text-muted">Or: {p.titles.slice(1).map((t) => `“${t}”`).join("  ")}</p>}
        {idea.pitch && <p className="mt-2 whitespace-pre-wrap rounded-md bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-ink-2">{idea.pitch}</p>}
      </div>

      {!ex ? (
        <AiButton
          label="Expand: angles, outline, next steps, what to look at"
          endpoint={`/api/ideas/${idea.id}/expand`}
          confirm="always"
          runningLabel="Developing your idea…"
          onResult={(r) => { setIdea(r.data as Idea); router.refresh(); }}
        />
      ) : (
        <div className="space-y-4">
          <p className="font-serif text-[16px] italic text-ink-2">{ex.logline}</p>
          {p?.firstSeconds && <p className="text-[13px]"><span className="eyebrow mr-1.5">Opens with</span>“{p.firstSeconds}”</p>}
          {p?.thumbnail && <p className="text-[13px]"><span className="eyebrow mr-1.5">Thumbnail</span>{p.thumbnail}</p>}
          <div>
            <div className="eyebrow mb-1.5">Angles you could take</div>
            <ul className="space-y-2">
              {ex.angles.map((a, i) => (
                <li key={i} className="rounded-md border border-line px-3 py-2 text-[13px]">
                  <div className="font-medium text-ink">{a.title}</div>
                  <div className="text-ink-2">{a.angle}</div>
                  <div className="mt-0.5 italic text-muted">Hook: “{a.hook}”</div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="eyebrow mb-1.5">Outline</div>
            <ol className="list-decimal space-y-1.5 pl-5 text-[13px]">
              {ex.outline.map((o, i) => (
                <li key={i}>
                  <span className="font-medium text-ink">{o.heading}</span>
                  <ul className="list-disc pl-4 text-ink-2">{o.beats.map((b, j) => <li key={j}>{b}</li>)}</ul>
                </li>
              ))}
            </ol>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="eyebrow mb-1.5">Next steps</div>
              <ol className="list-decimal space-y-0.5 pl-5 text-[13px] text-ink-2">{ex.nextSteps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </div>
            <div>
              <div className="eyebrow mb-1.5">Things to look at</div>
              <ul className="space-y-1 text-[13px]">
                {ex.toLookAt.map((t, i) => (
                  <li key={i}><span className="font-medium text-ink">{t.what}</span> <span className="text-ink-2">— {t.why}</span> <span className="text-muted">({t.where})</span></li>
                ))}
              </ul>
            </div>
          </div>
          {(ex.people.length > 0 || ex.risks.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {ex.people.length > 0 && (
                <div>
                  <div className="eyebrow mb-1.5">People to talk to</div>
                  <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">{ex.people.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              {ex.risks.length > 0 && (
                <div>
                  <div className="eyebrow mb-1.5">Watch out for</div>
                  <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">{ex.risks.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
            </div>
          )}
          <MediaPanel initialQuery={(p?.titles[0] ?? idea.title).split(/[:?!.]/)[0].split(" ").slice(0, 6).join(" ")} />
          <AiButton label="Re-expand" variant="ghost" size="sm" endpoint={`/api/ideas/${idea.id}/expand`} payload={{ regenerate: true }} confirm="always" onResult={(r) => setIdea(r.data as Idea)} />
        </div>
      )}

      <div className="rounded-lg border border-line p-3">
        <div className="eyebrow mb-1.5">Proposal</div>
        {idea.proposal ? (
          <div className="space-y-2">
            <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded bg-surface-2 p-3 font-sans text-[13px] leading-relaxed text-ink">{idea.proposal}</pre>
            <div className="flex flex-wrap gap-2">
              <a className="btn !py-1 !text-[12px]" href={`/api/ideas/${idea.id}/proposal`}>Download .md</a>
              <button className="btn !py-1 !text-[12px]" onClick={() => navigator.clipboard.writeText(idea.proposal ?? "")}>Copy</button>
            </div>
          </div>
        ) : (
          <p className="mb-2 text-[12.5px] text-muted">A pitch document you can send — tailored to who it&apos;s for.</p>
        )}
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <input className="input !py-1 text-[13px]" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Who it's for (e.g. a sponsor, Channel 24, a co-host)" />
          <input className="input !py-1 text-[13px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to include (budget, dates, access…)" />
        </div>
        <div className="mt-2">
          <AiButton label={idea.proposal ? "Rewrite proposal" : "Write a proposal"} size="sm" endpoint={`/api/ideas/${idea.id}/proposal`} payload={{ recipient: recipient || undefined, notes: notes || undefined, regenerate: !!idea.proposal }} confirm="always" runningLabel="Writing…" onResult={(r) => setIdea(r.data as Idea)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {idea.projectId ? (
          <Link className="btn" href={`/research/${idea.projectId}`}><Icon name="research" size={13} /> Open project</Link>
        ) : (
          <button
            className="btn-primary"
            onClick={async () => {
              const r = await api<{ projectId: string }>(`/api/ideas/${idea.id}/develop`, "POST", {});
              router.push(`/research/${r.projectId}`);
            }}
          >
            <Icon name="up" size={13} /> Turn into a project (research & script)
          </button>
        )}
      </div>
    </div>
  );
}
