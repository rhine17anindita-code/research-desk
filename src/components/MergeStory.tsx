"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "./api";

/** Search for another story covering the same event and fold this one into it. */
export function MergeStory({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; title: string; meta: string | null }[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) return setHits([]);
    const t = setTimeout(async () => {
      const r = await api<{ hits: { id: string; title: string; meta: string | null }[] }>(`/api/search?q=${encodeURIComponent(q)}&kinds=cluster&limit=8`);
      setHits(r.hits.filter((h) => h.id !== id));
    }, 250);
    return () => clearTimeout(t);
  }, [q, id]);

  if (!open)
    return (
      <button className="btn-ghost !px-0 !text-[12px]" onClick={() => setOpen(true)}>
        Same event as another story? Merge…
      </button>
    );
  return (
    <div className="space-y-1.5 rounded-md border border-line p-2.5">
      <div className="text-[12px] text-muted">Merge this story into another. Its articles, questions, notes and links move across.</div>
      <input className="input !py-1 text-[12.5px]" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for the other story…" />
      <ul className="max-h-48 overflow-auto">
        {hits.map((h) => (
          <li key={h.id}>
            <button
              className="block w-full rounded px-2 py-1 text-left text-[12.5px] hover:bg-surface-2"
              onClick={async () => {
                if (!confirm(`Merge into “${h.title}”?`)) return;
                await api(`/api/stories/${id}/merge`, "POST", { into: h.id });
                router.push(`/story/${h.id}`);
              }}
            >
              {h.title} <span className="text-muted">· {h.meta}</span>
            </button>
          </li>
        ))}
      </ul>
      <button className="btn-ghost !text-[12px]" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}
