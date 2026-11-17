"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { InlineIdeas } from "./InlineIdeas";
import type { BuildStory } from "@/lib/ideation/build-stories";

/** Today's best raw material: big stories that need an original angle, and untold ones. Refreshes with every feed update. */
export function StoriesToBuild({ stories }: { stories: BuildStory[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (!stories.length) return null;
  const current = stories.find((s) => s.id === open);
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-serif text-[20px] font-semibold">Stories worth building</h2>
        <span className="text-[12px] text-muted">Updates with every feed refresh</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {stories.map((s, n) => (
          <article key={s.id} className={`card rise flex flex-col overflow-hidden ${open === s.id ? "ring-2 ring-accent/40" : ""}`} style={{ animationDelay: `${n * 30}ms` }}>
            {s.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-28 w-full object-cover" />
            )}
            <div className="flex flex-1 flex-col gap-1.5 p-3.5">
              <span className={`text-[11px] font-semibold uppercase tracking-wide ${s.kind === "untold" ? "text-warn" : "text-accent"}`}>{s.kind === "untold" ? "Untold" : "Big story"}</span>
              <Link href={`/story/${s.id}`} className="font-serif text-[15.5px] font-semibold leading-snug text-ink hover:underline">{s.headline}</Link>
              <p className="text-[12px] leading-snug text-muted">{s.why}</p>
              <div className="mt-auto flex flex-wrap gap-1.5 pt-1.5">
                <button className="btn !py-1 !text-[12px]" onClick={() => setOpen(open === s.id ? null : s.id)}>
                  <Icon name="bulb" size={12} /> {open === s.id ? "Close" : "Ideas from this"}
                </button>
                <button
                  className="btn !py-1 !text-[12px]"
                  disabled={busy === s.id}
                  onClick={async () => {
                    setBusy(s.id);
                    const r = await api<{ project: { id: string } }>("/api/projects", "POST", { title: s.headline, item: { type: "cluster", id: s.id } });
                    router.push(`/research/${r.project.id}`);
                  }}
                >
                  <Icon name="up" size={12} /> Make it a project
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {current && (
        <div className="card mt-3 p-4">
          <p className="mb-2 text-[12.5px] text-muted">Ideas from: <span className="font-medium text-ink">{current.headline}</span></p>
          <InlineIdeas key={current.id} payload={{ clusterIds: [current.id] }} label="Ideas from this story" count={4} />
        </div>
      )}
    </section>
  );
}

/** Pulls fresh feeds in the background when the last refresh is old, then re-renders. Free (no AI). */
export function AutoRefresh() {
  const router = useRouter();
  const [state, setState] = useState<"working" | "done">("working");
  useEffect(() => {
    api("/api/ingest", "POST", {})
      .then(() => router.refresh())
      .catch(() => {})
      .finally(() => setState("done"));
  }, [router]);
  if (state === "done") return null;
  return <div className="rounded-full bg-accent-soft px-3 py-1.5 text-[12px] text-accent">Pulling the latest news, shows and videos…</div>;
}
