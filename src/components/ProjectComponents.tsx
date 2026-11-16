"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "./api";
import { Icon } from "./Icon";
import { QuestionList } from "./research/QuestionList";
import { AnswerView } from "./research/AnswerView";
import { Assistant } from "./research/Assistant";
import { AddSourceForm, SourceItem } from "./research/EvidencePanel";
import { Connections } from "./research/Connections";
import type { QuestionDetail } from "@/lib/research/question-detail";
import type { PipelineStage } from "@/lib/settings-defaults";
import type { Project, Question, Source } from "@/lib/types";

export function NewProject() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [thesis, setThesis] = useState("");
  return (
    <div className="card p-4">
      <div className="eyebrow mb-2">New project</div>
      <input className="input mb-2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Working title" />
      <textarea className="input mb-2 min-h-[56px]" value={thesis} onChange={(e) => setThesis(e.target.value)} placeholder="Research question or thesis (optional)" />
      <button
        className="btn-primary"
        disabled={!title.trim()}
        onClick={async () => {
          const r = await api<{ project: Project }>("/api/projects", "POST", { title, thesis: thesis || undefined });
          router.push(`/research/${r.project.id}`);
        }}
      >
        Create project
      </button>
    </div>
  );
}

export function StageSelect({ id, stage, stages }: { id: string; stage: string; stages: PipelineStage[] }) {
  const router = useRouter();
  return (
    <select
      className="input !w-auto !py-1 text-[13px]"
      value={stage}
      onChange={async (e) => {
        await api(`/api/projects/${id}`, "PATCH", { stage: e.target.value });
        router.refresh();
      }}
    >
      {stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
    </select>
  );
}

/** Inline-editable project text fields; saves on blur. */
export function ProjectField({ id, field, value, label, placeholder, multiline = true, big = false }: { id: string; field: keyof Project; value: string | null; label?: string; placeholder: string; multiline?: boolean; big?: boolean }) {
  const [v, setV] = useState(value ?? "");
  const [saved, setSaved] = useState(false);
  const save = async () => {
    if ((value ?? "") === v) return;
    await api(`/api/projects/${id}`, "PATCH", { [field]: v });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  const cls = big ? "w-full bg-transparent font-serif text-[26px] font-semibold tracking-tight outline-none placeholder:text-muted focus:bg-surface-2/50 rounded" : "input text-[13.5px]";
  return (
    <div>
      {label && (
        <div className="mb-1 flex items-center gap-2">
          <span className="eyebrow">{label}</span>
          {saved && <span className="text-[11px] text-ok">Saved</span>}
        </div>
      )}
      {multiline ? (
        <textarea className={`${cls} min-h-[72px]`} value={v} onChange={(e) => setV(e.target.value)} onBlur={save} placeholder={placeholder} />
      ) : (
        <input className={cls} value={v} onChange={(e) => setV(e.target.value)} onBlur={save} placeholder={placeholder} />
      )}
    </div>
  );
}

export function ProjectQuestions({ projectId, initial }: { projectId: string; initial: Question[] }) {
  const router = useRouter();
  const [questions, setQuestions] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<QuestionDetail | null>(null);
  const reloadList = useCallback(async () => {
    const r = await api<{ questions: Question[] }>(`/api/questions?projectId=${projectId}`);
    setQuestions(r.questions);
  }, [projectId]);
  const reloadDetail = useCallback(async () => {
    if (!selected) return setDetail(null);
    setDetail(await api<QuestionDetail>(`/api/questions/${selected}`));
  }, [selected]);
  useEffect(() => {
    void reloadDetail();
  }, [reloadDetail]);
  const reload = async () => {
    await Promise.all([reloadList(), reloadDetail()]);
    router.refresh();
  };
  return (
    <QuestionList
      questions={questions}
      selectedId={selected}
      onSelect={setSelected}
      onChange={reload}
      projectId={projectId}
      renderExpanded={(q) =>
        detail && detail.question.id === q.id ? (
          <div className="space-y-2">
            {detail.story && <p className="text-[12px] text-muted">From story: <Link className="text-accent hover:underline" href={`/story/${detail.story.id}?q=${q.id}`}>{detail.story.headline}</Link></p>}
            <AnswerView detail={detail} reload={reload} />
          </div>
        ) : (
          <p className="text-[12.5px] text-muted">Loading…</p>
        )
      }
    />
  );
}

export function RemoveItem({ projectId, itemType, itemId }: { projectId: string; itemType: string; itemId: string }) {
  const router = useRouter();
  return (
    <button
      className="btn-ghost !px-1 opacity-0 group-hover:opacity-100"
      title="Remove from project"
      onClick={async () => {
        await api(`/api/projects/${projectId}/items`, "DELETE", { itemType, itemId });
        router.refresh();
      }}
    >
      <Icon name="x" size={13} />
    </button>
  );
}

export function ProjectSide({ projectId, sources }: { projectId: string; sources: (Source & { via?: string })[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"evidence" | "assistant">("evidence");
  const [adding, setAdding] = useState(false);
  return (
    <div className="card flex h-full flex-col p-4">
      <div className="mb-3 flex gap-1 border-b border-line">
        {(["evidence", "assistant"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-2.5 pb-2 text-[13px] font-medium capitalize ${tab === t ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {t === "evidence" ? "Evidence library" : "Assistant"}
          </button>
        ))}
      </div>
      {tab === "assistant" ? (
        <div className="min-h-[480px] flex-1"><Assistant contextType="project" contextId={projectId} projectId={projectId} /></div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="eyebrow">Sources · {sources.length}</span>
              <button className="btn-ghost !px-1.5 !text-[12px]" onClick={() => setAdding((a) => !a)}><Icon name="plus" size={13} /> Add</button>
            </div>
            {adding && <div className="mb-2"><AddSourceForm projectId={projectId} onDone={() => { setAdding(false); router.refresh(); }} /></div>}
            {sources.length === 0 ? (
              <p className="text-[12.5px] text-muted">Sources attached to this project&apos;s questions, cited in their answers, or added here, collect in one place.</p>
            ) : (
              <ul className="space-y-1.5">
                {sources.map((s) => <SourceItem key={s.id} s={s} actions={s.via ? <span className="text-[11px] text-muted">{s.via}</span> : undefined} />)}
              </ul>
            )}
          </div>
          <Connections type="project" id={projectId} />
        </div>
      )}
    </div>
  );
}

export function DeleteProject({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      className="btn-ghost !text-[12px]"
      onClick={async () => {
        if (!confirm("Delete this project? Its questions, sources and notes are kept; only the project and its grouping are removed.")) return;
        await api(`/api/projects/${id}`, "DELETE");
        router.push("/research");
      }}
    >
      <Icon name="trash" size={13} /> Delete project
    </button>
  );
}
