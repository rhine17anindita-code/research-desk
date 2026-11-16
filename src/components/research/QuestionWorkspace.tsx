"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../api";
import { AnswerView } from "./AnswerView";
import { EvidencePanel } from "./EvidencePanel";
import { Assistant } from "./Assistant";
import { NotesPanel } from "./NotesPanel";
import type { QuestionDetail } from "@/lib/research/question-detail";

export function QuestionWorkspace({ initial }: { initial: QuestionDetail }) {
  const router = useRouter();
  const [detail, setDetail] = useState(initial);
  const [tab, setTab] = useState<"evidence" | "assistant">("evidence");
  const reload = useCallback(async () => {
    setDetail(await api<QuestionDetail>(`/api/questions/${initial.question.id}`));
    router.refresh();
  }, [initial.question.id, router]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-6">
        <div className="card p-5">
          <AnswerView detail={detail} reload={reload} compact={false} />
        </div>
        <NotesPanel notes={detail.notes} questionId={detail.question.id} clusterId={detail.question.clusterId ?? undefined} title="Notes on this question" />
      </div>
      <aside className="card p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <div className="mb-3 flex gap-1 border-b border-line">
          {(["evidence", "assistant"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-2.5 pb-2 text-[13px] font-medium capitalize ${tab === t ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>
              {t}
            </button>
          ))}
        </div>
        {tab === "evidence" ? (
          <EvidencePanel detail={detail} reload={reload} />
        ) : (
          <div className="min-h-[480px]">
            <Assistant contextType="question" contextId={detail.question.id} clusterId={detail.question.clusterId ?? undefined} />
          </div>
        )}
      </aside>
    </div>
  );
}
