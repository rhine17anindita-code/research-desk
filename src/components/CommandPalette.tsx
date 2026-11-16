"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { Icon } from "./Icon";
import { onRecentChange, readRecent, type RecentItem } from "./recent";

interface Hit {
  kind: string;
  id: string;
  title: string;
  meta: string | null;
  href: string;
}

const KIND_LABEL: Record<string, string> = {
  cluster: "Story", story: "Story", article: "Article", question: "Question", answer: "Answer", source: "Source", note: "Note", project: "Project",
};

const PAGES = [
  { title: "Discover", href: "/discover" },
  { title: "Explore", href: "/explore" },
  { title: "Research projects", href: "/research" },
  { title: "Library", href: "/library" },
  { title: "Search (full page)", href: "/search" },
  { title: "Settings — sources & topic watches", href: "/settings?tab=sources" },
  { title: "Settings — research profile & signals", href: "/settings?tab=personalisation" },
  { title: "Settings — AI & usage", href: "/settings?tab=ai" },
];

export function openPalette() {
  window.dispatchEvent(new Event("rd-open-palette"));
}

/** ⌘K / Ctrl+K quick switcher across everything you have collected or written. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [sel, setSel] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("rd-open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("rd-open-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setRecent(readRecent());
    setQ("");
    setSel(0);
    setTimeout(() => inputRef.current?.focus(), 0);
    return onRecentChange(() => setRecent(readRecent()));
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    const order: Record<string, number> = { cluster: 0, question: 1, project: 2, note: 3, source: 4, answer: 5, article: 6 };
    const t = setTimeout(async () => {
      try {
        const r = await api<{ hits: Hit[] }>(`/api/search?q=${encodeURIComponent(q)}&limit=40`);
        setHits([...r.hits].sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9)).slice(0, 24));
        setSel(0);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const items = useMemo(() => {
    if (q.trim().length >= 2) {
      const pages = PAGES.filter((p) => p.title.toLowerCase().includes(q.toLowerCase())).map((p) => ({ kind: "page", title: p.title, href: p.href, meta: null as string | null }));
      return [...pages, ...hits.map((h) => ({ kind: h.kind, title: h.title, href: h.href, meta: h.meta }))];
    }
    return [
      ...recent.slice(0, 8).map((r) => ({ kind: r.kind, title: r.title, href: r.href, meta: "Recent" as string | null })),
      ...PAGES.map((p) => ({ kind: "page", title: p.title, href: p.href, meta: null as string | null })),
    ];
  }, [q, hits, recent]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[12vh] backdrop-blur-[1px]" onMouseDown={() => setOpen(false)}>
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-2xl" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Quick search">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Icon name="search" size={16} className="text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter" && items[sel]) {
                go(items[sel].href);
              }
            }}
            placeholder="Jump to a story, question, source, note, project or page…"
            className="w-full bg-transparent py-3.5 text-[15px] text-ink outline-none placeholder:text-muted"
          />
          <kbd className="rounded border border-line px-1.5 text-[11px] text-muted">esc</kbd>
        </div>
        <ul className="max-h-[55vh] overflow-y-auto py-1.5">
          {items.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-muted">{q.trim().length >= 2 ? (loading ? "Searching…" : "Nothing found.") : "Start typing to search everything."}</li>}
          {items.map((it, i) => (
            <li key={it.kind + it.href + i}>
              <button
                onMouseEnter={() => setSel(i)}
                onClick={() => go(it.href)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left ${i === sel ? "bg-accent-soft" : ""}`}
              >
                <span className="w-16 shrink-0 text-[10.5px] font-semibold uppercase tracking-wide text-muted">{it.kind === "page" ? "Go to" : KIND_LABEL[it.kind] ?? it.kind}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{it.title}</span>
                {it.meta && <span className="shrink-0 truncate text-[11.5px] text-muted">{it.meta}</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-line px-4 py-2 text-[11px] text-muted">
          <span>↑↓ to move · ↵ to open</span>
          <span>⌘K / Ctrl+K anywhere</span>
        </div>
      </div>
    </div>
  );
}

/** Records the current page in the Recent list. Renders nothing. */
export function TrackVisit({ kind, title, href }: Omit<RecentItem, "at">) {
  useEffect(() => {
    import("./recent").then((m) => m.pushRecent({ kind, title, href }));
  }, [kind, title, href]);
  return null;
}
