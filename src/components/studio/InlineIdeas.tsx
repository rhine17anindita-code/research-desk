"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { AiButton } from "../AiButton";
import { IdeaCard, type BackingInfo } from "../ideas/IdeaCard";
import type { Idea } from "@/lib/ideation/repo";

/** Save / skip / develop for one idea, wherever it is shown. Every choice teaches the taste profile. */
export function IdeaQuickActions({ idea, onDone }: { idea: Idea; onDone?: (status: string) => void }) {
  const router = useRouter();
  const [state, setState] = useState(idea.status);
  const set = async (status: "saved" | "skipped") => {
    await api(`/api/ideas/${idea.id}`, "PATCH", { status });
    setState(status);
    onDone?.(status);
  };
  if (state === "saved") return <span className="text-[12px] text-ok"><Icon name="check" size={12} className="inline" /> Saved</span>;
  if (state === "skipped") return <span className="text-[12px] text-muted">Skipped</span>;
  return (
    <div className="flex flex-wrap gap-1">
      <button className="btn !py-1 !text-[12px]" onClick={() => set("skipped")}><Icon name="x" size={12} /> Skip</button>
      <button className="btn !py-1 !text-[12px] !text-ok" onClick={() => set("saved")}><Icon name="bookmark" size={12} /> Save</button>
      <button
        className="btn-primary !py-1 !text-[12px]"
        onClick={async () => {
          const r = await api<{ projectId: string }>(`/api/ideas/${idea.id}/develop`, "POST", {});
          router.push(`/research/${r.projectId}`);
        }}
      >
        <Icon name="up" size={12} /> Develop
      </button>
    </div>
  );
}

/**
 * Generate ideas from a specific thing (a story, a statement, an inspiration, a topic)
 * and show them right here — no need to go anywhere else to see or act on them.
 */
export function InlineIdeas({ payload, label, count = 4 }: { payload: Record<string, unknown>; label: string; count?: number }) {
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [backing, setBacking] = useState<Record<string, BackingInfo>>({});
  return (
    <div className="space-y-2">
      <AiButton
        label={ideas ? "More ideas" : label}
        size="sm"
        endpoint="/api/ideas/generate"
        payload={{ count, ...payload }}
        confirm="always"
        runningLabel="Finding angles…"
        onResult={async (r) => {
          const data = r.data as { ideas: Idea[] };
          setIdeas((prev) => [...data.ideas, ...(prev ?? [])]);
          const ids = data.ideas.map((i) => i.id).join(",");
          if (ids) {
            const b = await api<{ backing: Record<string, BackingInfo> }>(`/api/ideas/backing?ids=${ids}`);
            setBacking((x) => ({ ...x, ...b.backing }));
          }
        }}
      />
      {ideas && ideas.length === 0 && <p className="text-[12px] text-muted">No idea passed the quality bar this time — try a direction or a different source.</p>}
      {ideas?.map((i) => (
        <div key={i.id} className="space-y-1.5">
          <IdeaCard idea={i} backing={backing[i.id] ?? { stories: [], sources: [] }} compact />
          <IdeaQuickActions idea={i} />
        </div>
      ))}
    </div>
  );
}
