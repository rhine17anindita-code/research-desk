"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../api";
import { Icon } from "../Icon";
import { IdeaCard, type BackingInfo } from "./IdeaCard";
import type { Idea } from "@/lib/ideation/repo";

const SKIP_REASONS = ["Not my topic", "Wrong format for this", "Too obvious / already covered", "Too much effort", "Not timely", "Weak hook"];
const SAVE_REASONS = ["Strong hook", "Great untold angle", "Right format", "My region / beat", "Timely"];

type Action = { idea: Idea; status: "skipped" | "saved" };

/** Browse ideas one at a time. Every choice (and optional reason) teaches the taste profile. */
export function IdeaDeck({ initial, backing }: { initial: Idea[]; backing: Record<string, BackingInfo> }) {
  const router = useRouter();
  const [queue, setQueue] = useState(initial);
  const [last, setLast] = useState<Action | null>(null);
  const [reasonFor, setReasonFor] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const idea = queue[0];

  const act = useCallback(
    async (status: "skipped" | "saved") => {
      if (!idea || busy) return;
      setBusy(true);
      await api(`/api/ideas/${idea.id}`, "PATCH", { status });
      const a = { idea, status };
      setLast(a);
      setReasonFor(a);
      setQueue((q) => q.slice(1));
      setBusy(false);
    },
    [idea, busy],
  );

  const develop = useCallback(async () => {
    if (!idea || busy) return;
    setBusy(true);
    const r = await api<{ projectId: string }>(`/api/ideas/${idea.id}/develop`, "POST", {});
    router.push(`/research/${r.projectId}`);
  }, [idea, busy, router]);

  const undo = async () => {
    if (!last) return;
    await api(`/api/ideas/${last.idea.id}`, "PATCH", { status: "new" });
    setQueue((q) => [last.idea, ...q]);
    setLast(null);
    setReasonFor(null);
  };

  const giveReason = async (reason: string) => {
    if (!reasonFor) return;
    await api(`/api/ideas/${reasonFor.idea.id}`, "PATCH", { reason });
    setReasonFor(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || e.metaKey || e.ctrlKey) return;
      if (e.key === "ArrowLeft") act("skipped");
      if (e.key === "ArrowRight") act("saved");
      if (e.key === "ArrowUp") {
        e.preventDefault();
        develop();
      }
      if (e.key.toLowerCase() === "z") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [act, develop, last]);

  if (!idea)
    return (
      <div className="card px-6 py-10 text-center">
        <h2 className="font-serif text-[20px] font-semibold">You&apos;re through this batch</h2>
        <p className="mx-auto mt-1 max-w-md text-[13.5px] text-muted">Generate a fresh batch below. It uses what you just saved and skipped, so each batch should fit you better.</p>
        {last && (
          <button className="btn mt-3" onClick={undo}>
            <Icon name="undo" size={14} /> Undo last
          </button>
        )}
      </div>
    );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[12px] text-muted">
        <span>{queue.length} to go in this deck</span>
        <span className="hidden sm:inline">Keys: ← skip · → save · ↑ develop · Z undo</span>
      </div>
      <IdeaCard idea={idea} backing={backing[idea.id] ?? { stories: [], sources: [] }} />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button className="btn !py-2.5 !text-[14px]" disabled={busy} onClick={() => act("skipped")}>
          <Icon name="x" size={16} /> Skip
        </button>
        <button className="btn-primary !py-2.5 !text-[14px]" disabled={busy} onClick={develop} title="Create a research project from this idea">
          <Icon name="up" size={16} /> Develop
        </button>
        <button className="btn !border-ok/40 !py-2.5 !text-[14px] !text-ok" disabled={busy} onClick={() => act("saved")}>
          <Icon name="bookmark" size={16} /> Save
        </button>
      </div>
      {reasonFor && (
        <div className="mt-3 rounded-md border border-line bg-surface px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between text-[12px] text-muted">
            <span>
              {reasonFor.status === "saved" ? "Saved" : "Skipped"} “{reasonFor.idea.title.slice(0, 60)}{reasonFor.idea.title.length > 60 ? "…" : ""}” — why? (optional, it learns from this)
            </span>
            <button className="btn-ghost !px-1 !text-[12px]" onClick={undo}>
              <Icon name="undo" size={13} /> Undo
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {(reasonFor.status === "saved" ? SAVE_REASONS : SKIP_REASONS).map((r) => (
              <button key={r} className="chip hover:border-accent hover:text-accent" onClick={() => giveReason(r)}>{r}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
