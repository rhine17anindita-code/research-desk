"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../api";

/** Opt-in: prepares today's batch once per day per channel when the Studio opens. */
export function DailyTrigger() {
  const router = useRouter();
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    api<{ created?: number; skipped?: string; message?: string }>("/api/ideas/daily", "POST", {})
      .then((r) => {
        setState("done");
        if (r.created) router.refresh();
      })
      .catch((e) => {
        setState("error");
        setMsg((e as Error).message);
      });
  }, [router]);
  if (state === "done") return null;
  return (
    <div className={`rounded-md px-3 py-2 text-[12.5px] ${state === "error" ? "bg-bad-soft text-bad" : "bg-ai-soft text-ai"}`}>
      {state === "working" ? "Preparing today's ideas for this channel…" : `Couldn't prepare today's ideas: ${msg}`}
    </div>
  );
}
