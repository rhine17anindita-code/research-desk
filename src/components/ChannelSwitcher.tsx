"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { Icon } from "./Icon";

/** Pick which creator channel/personality you are working as. Everything below follows it. */
export function ChannelSwitcher({ channels, active }: { channels: { id: string; name: string; color: string }[]; active: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const current = channels.find((c) => c.id === active) ?? channels[0];
  return (
    <div className="relative mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface px-2.5 py-2 text-left shadow-sm transition-all hover:-translate-y-px hover:border-line-strong"
        aria-expanded={open}
      >
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold text-white ch-dot-${current?.color ?? "coral"}`}>{current?.name.slice(0, 1)}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10.5px] uppercase tracking-wide text-muted">Channel</span>
          <span className="block truncate text-[13px] font-medium text-ink">{current?.name}</span>
        </span>
        <Icon name="down" size={14} className="text-muted" />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-40 mt-1 rounded-md border border-line bg-surface p-1 shadow-lg">
          {channels.map((c) => (
            <button
              key={c.id}
              className={`flex w-full items-center gap-2 truncate rounded-lg px-2.5 py-1.5 text-left text-[13px] ${c.id === active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-2"}`}
              onClick={async () => {
                setOpen(false);
                if (c.id === active) return;
                await api("/api/channels/active", "POST", { id: c.id });
                router.refresh();
              }}
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ch-dot-${c.color}`} />
              {c.name}
            </button>
          ))}
          <Link href="/settings?tab=channels" onClick={() => setOpen(false)} className="mt-1 block rounded border-t border-line px-2.5 py-1.5 text-[12.5px] text-muted hover:text-ink">
            + New or manage channels
          </Link>
        </div>
      )}
    </div>
  );
}
