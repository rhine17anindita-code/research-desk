"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "./api";
import { Icon } from "./Icon";
import { timeAgo } from "@/lib/format";

export type RefreshWhat = "news" | "talk" | "creators" | "pulse" | "performance";

/** A small refresh button with "updated 4 min ago", for any section. Free. */
export function SectionRefresh({ what, updatedAt }: { what: RefreshWhat; updatedAt?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
      {msg ?? (updatedAt ? `updated ${timeAgo(updatedAt)}` : "")}
      <button
        className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-accent disabled:opacity-50"
        title="Refresh this now"
        aria-label="Refresh this section"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg("refreshing…");
          try {
            const r = await api<{ message: string }>("/api/refresh", "POST", { what });
            setMsg(r.message);
            router.refresh();
            setTimeout(() => setMsg(null), 6000);
          } catch (e) {
            setMsg((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Icon name="refresh" size={12} className={busy ? "animate-spin" : ""} />
      </button>
    </span>
  );
}
