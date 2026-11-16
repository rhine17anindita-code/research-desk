"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { Icon } from "./Icon";
import { AiButton } from "./AiButton";

export function RefreshButton({ label = "Refresh feeds", primary = false }: { label?: string; primary?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className={primary ? "btn-primary" : "btn"}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const { result } = await api<{ result: { articlesNew: number; clustersNew: number; feedsFailed: number; feedsOk: number } }>("/api/ingest", "POST", {});
            setMsg(
              `${result.articlesNew} new article${result.articlesNew === 1 ? "" : "s"}, ${result.clustersNew} new stor${result.clustersNew === 1 ? "y" : "ies"} from ${result.feedsOk} feeds${result.feedsFailed ? ` · ${result.feedsFailed} feed${result.feedsFailed === 1 ? "" : "s"} failed (see Settings)` : ""}`,
            );
            router.refresh();
          } catch (e) {
            setMsg((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Icon name="refresh" size={14} className={busy ? "animate-spin" : ""} /> {busy ? "Fetching…" : label}
      </button>
      {msg && <p className="text-right text-[12px] text-muted">{msg}</p>}
    </div>
  );
}

export function SampleButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await api("/api/sample", "POST", {}).catch(() => null);
        setBusy(false);
        router.refresh();
      }}
    >
      Load fictional sample stories
    </button>
  );
}

export function AssessButton({ ids }: { ids: string[] }) {
  const router = useRouter();
  if (!ids.length) return null;
  return (
    <AiButton
      label={`Assess top ${ids.length} with AI`}
      title="One batched AI call judges which editorial signals apply to each of these stories. The result is cached and adds to their ranking."
      endpoint="/api/stories/assess"
      payload={{ ids }}
      confirm="always"
      size="sm"
      onResult={() => router.refresh()}
    />
  );
}
