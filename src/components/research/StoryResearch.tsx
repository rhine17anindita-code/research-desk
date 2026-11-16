"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "../api";
import { QuestionList } from "./QuestionList";
import { AnswerView } from "./AnswerView";
import { EvidencePanel } from "./EvidencePanel";
import { Assistant } from "./Assistant";
import type { QuestionDetail } from "@/lib/research/question-detail";
import type { Question } from "@/lib/types";

/**
 * Center + right panes of the story workspace. The selected question is kept in
 * the URL (?q=) so returning to the story restores your place.
 */
export function StoryResearch({ clusterId, initialQuestions }: { clusterId: string; initialQuestions: Question[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [questions, setQuestions] = useState(initialQuestions);
  const [selected, setSelected] = useState<string | null>(params.get("q"));
  const [detail, setDetail] = useState<QuestionDetail | null>(null);
  const [tab, setTab] = useState<"evidence" | "assistant">(params.get("tab") === "assistant" ? "assistant" : "evidence");
  const [rightOpen, setRightOpen] = useState(true);

  const reloadList = useCallback(async () => {
    const r = await api<{ questions: Question[] }>(`/api/questions?clusterId=${clusterId}`);
    setQuestions(r.questions);
  }, [clusterId]);

  const reloadDetail = useCallback(async () => {
    if (!selected) return setDetail(null);
    try {
      const d = await api<QuestionDetail>(`/api/questions/${selected}`);
      setDetail(d);
    } catch {
      setDetail(null);
    }
  }, [selected]);

  useEffect(() => {
    void reloadDetail();
  }, [reloadDetail]);

  const select = (id: string | null) => {
    setSelected(id);
    const sp = new URLSearchParams(params.toString());
    if (id) sp.set("q", id);
    else sp.delete("q");
    router.replace(`?${sp.toString()}`, { scroll: false });
  };

  const reloadAll = async () => {
    await Promise.all([reloadList(), reloadDetail()]);
    router.refresh();
  };

  return (
    <div className={`grid min-h-0 gap-6 ${rightOpen ? "xl:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
      <div className="min-w-0">
        <QuestionList
          questions={questions}
          selectedId={selected}
          onSelect={select}
          onChange={reloadAll}
          clusterId={clusterId}
          renderExpanded={(q) =>
            detail && detail.question.id === q.id ? <AnswerView detail={detail} reload={reloadAll} /> : <p className="text-[12.5px] text-muted">Loading…</p>
          }
        />
      </div>

      <aside className={`min-w-0 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto ${rightOpen ? "" : "hidden"}`}>
        <div className="card flex h-full flex-col p-4">
          <div className="mb-3 flex items-center gap-1 border-b border-line">
            {(["evidence", "assistant"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-2.5 pb-2 text-[13px] font-medium capitalize ${tab === t ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>
                {t}
              </button>
            ))}
            <button className="btn-ghost ml-auto !text-[12px]" onClick={() => setRightOpen(false)} title="Collapse panel">Hide</button>
          </div>
          {tab === "assistant" ? (
            <div className="min-h-[420px] flex-1">
              <Assistant contextType="cluster" contextId={clusterId} clusterId={clusterId} />
            </div>
          ) : detail ? (
            <>
              <div className="mb-3 rounded-md bg-surface-2 px-2.5 py-2 text-[12.5px] leading-snug text-ink-2">
                <span className="text-muted">Evidence for: </span>
                {detail.question.text}
              </div>
              <EvidencePanel detail={detail} reload={reloadAll} />
            </>
          ) : (
            <p className="text-[13px] leading-relaxed text-muted">
              Select a question to see its evidence, search for sources, run deeper research, and connect it to other material. Or switch to the assistant to think through the story.
            </p>
          )}
        </div>
      </aside>
      {!rightOpen && (
        <button className="btn fixed bottom-4 right-4 z-20 shadow-md" onClick={() => setRightOpen(true)}>
          Show evidence & assistant
        </button>
      )}
    </div>
  );
}
