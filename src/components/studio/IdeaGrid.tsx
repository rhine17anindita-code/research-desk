"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { IdeaCard, type BackingInfo } from "../ideas/IdeaCard";
import { IdeaDeck } from "../ideas/IdeaDeck";
import { FORMAT_BY_ID } from "@/lib/ideation/formats";
import type { Idea } from "@/lib/ideation/repo";

type Filter = "all" | "news" | "evergreen" | "visual" | "written" | "mine";
const NEWS_KINDS = new Set(["news", "trend", "statement", "inspiration"]);
const PAGE = 12;

function scoreOf(i: Idea) {
  const s = i.packaging?.scores;
  return s ? s.hook + s.massAppeal + s.novelty + s.evidence * 0.5 : 0;
}

function Tile({ idea, onOpen, onAct, index }: { idea: Idea; onOpen: () => void; onAct: (s: "saved" | "skipped") => void; index: number }) {
  const f = FORMAT_BY_ID[idea.format];
  const s = idea.packaging?.scores;
  const why = idea.whyUntold || idea.whyItLands || idea.angle || "";
  return (
    <article
      className="card card-hover rise group relative flex cursor-pointer flex-col overflow-hidden"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
      onClick={onOpen}
    >
      <div className={`h-1.5 w-full ${f?.medium === "written" ? "bg-warn/70" : "bg-gradient-to-r from-accent to-accent-2"}`} />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className={`font-semibold uppercase tracking-wide ${f?.medium === "written" ? "text-warn" : "text-accent"}`}>{f?.label ?? idea.format}</span>
          {s && (
            <span className="flex items-center gap-1 tabular-nums text-muted" title={`Hook ${s.hook} · Reach ${s.massAppeal} · Fresh ${s.novelty} · Proof ${s.evidence}`}>
              <Icon name="spark" size={11} className="text-accent" />
              {Math.round(((s.hook + s.massAppeal + s.novelty) / 30) * 100)}
            </span>
          )}
        </div>
        <h3 className="font-serif text-[17px] font-semibold leading-snug text-ink">{idea.title}</h3>
        {why && <p className="line-clamp-3 text-[13px] leading-relaxed text-ink-2">{why}</p>}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-[11px] text-muted">{idea.timeliness ?? (idea.origin === "user" ? "your idea" : "")}</span>
          <span className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
            <button className="btn-ghost !px-2 !py-1 !text-[12px]" title="Skip" onClick={() => onAct("skipped")}>
              <Icon name="x" size={14} />
            </button>
            <button className="btn-ghost !px-2 !py-1 !text-[12px] !text-ok" title="Save" onClick={() => onAct("saved")}>
              <Icon name="bookmark" size={14} />
            </button>
          </span>
        </div>
      </div>
    </article>
  );
}

/**
 * The Studio's idea view: a scannable grid (default) or a one-at-a-time deck
 * (focus mode). Opening a tile shows everything in a side panel.
 */
export function IdeaGrid({ initial, backing }: { initial: Idea[]; backing: Record<string, BackingInfo> }) {
  const router = useRouter();
  const [ideas, setIdeas] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"best" | "new">("best");
  const [shown, setShown] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => setIdeas(initial), [initial]);
  useEffect(() => {
    try {
      if (localStorage.getItem("rd.ideaView") === "focus") setFocus(true);
    } catch {
      /* ignore */
    }
  }, []);
  const setView = (f: boolean) => {
    setFocus(f);
    try {
      localStorage.setItem("rd.ideaView", f ? "focus" : "grid");
    } catch {
      /* ignore */
    }
  };

  const list = useMemo(() => {
    const l = ideas.filter((i) => {
      if (filter === "all") return true;
      if (filter === "mine") return i.origin === "user";
      if (filter === "visual" || filter === "written") return (FORMAT_BY_ID[i.format]?.medium ?? "visual") === filter;
      const isNews = NEWS_KINDS.has(i.sourceKind ?? "news") && i.timeliness !== "evergreen";
      return filter === "news" ? isNews : !isNews;
    });
    return sort === "best" ? [...l].sort((a, b) => scoreOf(b) - scoreOf(a)) : [...l].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [ideas, filter, sort]);

  const openIdx = openId ? list.findIndex((i) => i.id === openId) : -1;
  const open = openIdx >= 0 ? list[openIdx] : null;

  const act = useCallback(async (idea: Idea, status: "saved" | "skipped") => {
    await api(`/api/ideas/${idea.id}`, "PATCH", { status });
    setIdeas((xs) => xs.filter((x) => x.id !== idea.id));
    setToast(`${status === "saved" ? "Saved" : "Skipped"} “${idea.title.slice(0, 50)}${idea.title.length > 50 ? "…" : ""}”`);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const step = useCallback(
    (d: number) => {
      if (openIdx < 0) return;
      const next = list[openIdx + d];
      if (next) setOpenId(next.id);
    },
    [openIdx, list],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || e.metaKey || e.ctrlKey) return;
      if (e.key === "Escape") setOpenId(null);
      if (e.key === "ArrowRight" || e.key === "j") step(1);
      if (e.key === "ArrowLeft" || e.key === "k") step(-1);
      if (e.key.toLowerCase() === "s") { const nxt = list[openIdx + 1]; void act(open, "saved").then(() => setOpenId(nxt?.id ?? null)); }
      if (e.key.toLowerCase() === "x") { const nxt = list[openIdx + 1]; void act(open, "skipped").then(() => setOpenId(nxt?.id ?? null)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, openIdx, list, step, act]);

  const filters: [Filter, string][] = [
    ["all", "All"],
    ["news", "Today's news"],
    ["evergreen", "Evergreen"],
    ["visual", "Video & visual"],
    ["written", "Written"],
    ["mine", "Mine"],
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {filters.map(([id, label]) => (
          <button key={id} onClick={() => { setFilter(id); setShown(PAGE); }} className={filter === id ? "chip-accent" : "chip hover:border-line-strong"}>
            {label}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1">
          <select className="input !w-auto !rounded-full !py-0.5 text-[12px]" value={sort} onChange={(e) => setSort(e.target.value as "best" | "new")}>
            <option value="best">Best first</option>
            <option value="new">Newest first</option>
          </select>
          <button className={`btn !py-0.5 !text-[12px] ${focus ? "!border-accent !text-accent" : ""}`} onClick={() => setView(!focus)} title="One idea at a time, swipe-style">
            <Icon name={focus ? "panel" : "bulb"} size={13} /> {focus ? "Grid" : "Focus mode"}
          </button>
        </span>
      </div>

      {focus ? (
        <IdeaDeck initial={list} backing={backing} key={filter + sort} />
      ) : list.length === 0 ? (
        <div className="card px-6 py-8 text-center text-[13.5px] text-muted">Nothing here — try another filter or generate a fresh batch.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {list.slice(0, shown).map((i, n) => (
              <Tile key={i.id} idea={i} index={n} onOpen={() => setOpenId(i.id)} onAct={(s) => act(i, s)} />
            ))}
          </div>
          {list.length > shown && (
            <div className="mt-3 text-center">
              <button className="btn" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, list.length - shown)} more</button>
            </div>
          )}
        </>
      )}

      {open && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/25 backdrop-blur-[1px]" onClick={() => setOpenId(null)}>
          <div className="rise flex h-full w-full max-w-[640px] flex-col overflow-hidden bg-paper shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
              <button className="btn-ghost !px-2" onClick={() => step(-1)} disabled={openIdx <= 0} title="Previous (←)"><Icon name="arrowLeft" size={15} /></button>
              <button className="btn-ghost !px-2" onClick={() => step(1)} disabled={openIdx >= list.length - 1} title="Next (→)"><Icon name="right" size={15} /></button>
              <span className="text-[12px] text-muted">{openIdx + 1} of {list.length} · S save · X skip · Esc close</span>
              <button className="btn-ghost ml-auto !px-2" onClick={() => setOpenId(null)}><Icon name="x" size={15} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <IdeaCard idea={open} backing={backing[open.id] ?? { stories: [], sources: [] }} />
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-line bg-surface p-3">
              <button className="btn !py-2" onClick={async () => { const nxt = list[openIdx + 1]; await act(open, "skipped"); setOpenId(nxt?.id ?? null); }}>
                <Icon name="x" size={15} /> Skip
              </button>
              <button
                className="btn-primary !py-2"
                onClick={async () => {
                  const r = await api<{ projectId: string }>(`/api/ideas/${open.id}/develop`, "POST", {});
                  router.push(`/research/${r.projectId}`);
                }}
              >
                <Icon name="up" size={15} /> Develop
              </button>
              <button className="btn !py-2 !text-ok" onClick={async () => { const nxt = list[openIdx + 1]; await act(open, "saved"); setOpenId(nxt?.id ?? null); }}>
                <Icon name="bookmark" size={15} /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="rise fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[13px] text-paper shadow-lg">{toast}</div>}
    </div>
  );
}
