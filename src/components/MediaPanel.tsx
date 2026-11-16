"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { Icon } from "./Icon";

interface MediaItem { kind: string; title: string; url: string; thumbnail: string | null; meta: string | null; source: string }
interface MediaResult { images: MediaItem[]; archive: MediaItem[]; videos: MediaItem[]; youtube: { configured: boolean; searchUrl: string } }

/**
 * Photos (Wikimedia Commons, freely licensed), archival footage/documents (Internet Archive)
 * and videos (YouTube) for a story or idea. Free lookups, loaded only when opened.
 */
export function MediaPanel({ initialQuery, startOpen = false, compact = false }: { initialQuery: string; startOpen?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [q, setQ] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState<"images" | "archive" | "videos">("images");
  const [data, setData] = useState<MediaResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !query.trim()) return;
    setBusy(true);
    api<MediaResult>(`/api/media?q=${encodeURIComponent(query)}`)
      .then(setData)
      .catch(() => setData({ images: [], archive: [], videos: [], youtube: { configured: false, searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` } }))
      .finally(() => setBusy(false));
  }, [open, query]);

  if (!open)
    return (
      <button className="btn !py-1 !text-[12px]" onClick={() => setOpen(true)}>
        <Icon name="discover" size={13} /> Visuals, archive & video
      </button>
    );

  const items = data ? (tab === "images" ? data.images : tab === "archive" ? data.archive : data.videos) : [];
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="mb-2 flex items-center gap-2">
        <input
          className="input !py-1 text-[12.5px]"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setQuery(q)}
          placeholder="What to look for"
        />
        <button className="btn !py-1 !text-[12px]" onClick={() => setQuery(q)}>Search</button>
        {!startOpen && <button className="btn-ghost !px-1" onClick={() => setOpen(false)}><Icon name="x" size={13} /></button>}
      </div>
      <div className="mb-2 flex gap-1 text-[12px]">
        {([
          ["images", `Photos${data ? ` ${data.images.length}` : ""}`],
          ["archive", `Archive${data ? ` ${data.archive.length}` : ""}`],
          ["videos", `Video${data && data.youtube.configured ? ` ${data.videos.length}` : ""}`],
        ] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`rounded-full border px-2.5 py-0.5 ${tab === id ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>
      {busy && <p className="py-4 text-center text-[12px] text-muted">Searching Commons, the Internet Archive and YouTube…</p>}
      {!busy && data && tab === "videos" && !data.youtube.configured && (
        <p className="mb-2 text-[12px] text-muted">
          Add a free <code className="rounded bg-surface-2 px-1">YOUTUBE_API_KEY</code> to show videos here.{" "}
          <a href={data.youtube.searchUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">Search YouTube for “{query}” →</a>
        </p>
      )}
      {!busy && data && items.length === 0 && !(tab === "videos" && !data.youtube.configured) && <p className="py-3 text-center text-[12px] text-muted">Nothing found — try simpler words (a name, place or event).</p>}
      {!busy && items.length > 0 && (
        <ul className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
          {items.map((m) => (
            <li key={m.url} className="overflow-hidden rounded-md border border-line">
              <a href={m.url} target="_blank" rel="noreferrer" className="block hover:opacity-90">
                {m.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-video w-full bg-surface-2 object-cover" />
                ) : (
                  <div className="aspect-video w-full bg-surface-2" />
                )}
                <div className="p-1.5">
                  <div className="line-clamp-2 text-[11.5px] font-medium leading-snug text-ink">{m.title}</div>
                  {m.meta && <div className="mt-0.5 line-clamp-1 text-[10.5px] text-muted">{m.meta}</div>}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
      {tab === "images" && data && data.images.length > 0 && <p className="mt-2 text-[11px] text-muted">Wikimedia Commons files are freely licensed — check each file&apos;s licence and credit the author.</p>}
      {tab === "archive" && data && data.archive.length > 0 && <p className="mt-2 text-[11px] text-muted">Internet Archive items vary in rights status — check each item before reusing footage.</p>}
    </div>
  );
}
