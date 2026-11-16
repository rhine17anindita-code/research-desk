"use client";

import { useState } from "react";
import { api } from "./api";
import { Icon } from "./Icon";
import { modelName, pctOf } from "@/lib/format";

type Phase = "idle" | "checking" | "confirm" | "running";

interface Props {
  label: string;
  endpoint: string;
  payload?: Record<string, unknown>;
  /** "always": show the cost before every run. "auto": only when the worst case exceeds $0.02. */
  confirm?: "always" | "auto";
  onResult: (data: Record<string, unknown>) => void;
  variant?: "ai" | "ghost";
  title?: string;
  runningLabel?: string;
  size?: "sm" | "md";
}

/**
 * Every paid model call in the UI goes through this button. It asks the server
 * for a worst-case estimate first, explains why AI is unavailable if it is,
 * and never runs a call the user did not deliberately start.
 */
export function AiButton({ label, endpoint, payload = {}, confirm = "auto", onResult, variant = "ai", title, runningLabel, size = "md" }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [estimate, setEstimate] = useState<{ usd: number; model: string } | null>(null);
  const [daily, setDaily] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function run() {
    setPhase("running");
    setError(null);
    try {
      const res = await api<Record<string, unknown>>(endpoint, "POST", payload);
      const cost = typeof res.costUsd === "number" ? res.costUsd : 0;
      setNote(res.cached ? "Reused a saved result — free." : cost ? `Done · used ${pctOf(cost, daily)} of today's AI budget` : "Done");
      setTimeout(() => setNote(null), 5000);
      onResult(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPhase("idle");
    }
  }

  async function start() {
    setError(null);
    setNote(null);
    setPhase("checking");
    try {
      const [{ status }, est] = await Promise.all([
        api<{ status: { available: boolean; unavailableReason: string | null; dailyLimit: number } }>("/api/ai/status"),
        api<{ estimate: { usd: number; model: string } }>(endpoint, "POST", { ...payload, estimateOnly: true }),
      ]);
      if (!status.available) {
        setError(status.unavailableReason ?? "AI is unavailable.");
        setPhase("idle");
        return;
      }
      setEstimate(est.estimate);
      setDaily(status.dailyLimit);
      if (confirm === "auto" && est.estimate.usd < status.dailyLimit * 0.01) {
        await run();
        return;
      }
      setPhase("confirm");
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    }
  }

  const cls = variant === "ai" ? "btn-ai" : "btn-ghost";
  const pad = size === "sm" ? "!px-2 !py-1 !text-[12px]" : "";

  return (
    <div className="inline-flex flex-col items-start gap-1">
      {phase === "confirm" && estimate ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-ai/30 bg-ai-soft px-2.5 py-1.5 text-[12.5px] text-ink-2">
          <span>
            Uses up to <b className="font-medium">{pctOf(estimate.usd, daily)}</b> of today&apos;s AI budget
            <span className="text-muted"> (usually less · {modelName(estimate.model)})</span>
          </span>
          <button className="btn-primary !py-1" onClick={run}>
            Run
          </button>
          <button className="btn-ghost" onClick={() => setPhase("idle")}>
            Cancel
          </button>
        </div>
      ) : (
        <button className={`${cls} ${pad}`} onClick={start} disabled={phase !== "idle"} title={title ?? "Uses a paid AI call; you will see the cost first when it matters."}>
          <Icon name="spark" size={14} />
          {phase === "running" ? runningLabel ?? "Working…" : phase === "checking" ? "Checking…" : label}
        </button>
      )}
      {error && <p className="max-w-md text-[12px] text-bad">{error}</p>}
      {note && <p className="text-[12px] text-muted">{note}</p>}
    </div>
  );
}
