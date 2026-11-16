"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { LINK_RELATIONS, type Link as LinkT, type ObjectType } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = { cluster: "Story", question: "Question", answer: "Answer", source: "Source", project: "Project", note: "Note", article: "Article" };

function hrefFor(type: string, id: string) {
  switch (type) {
    case "cluster": return `/story/${id}`;
    case "question": return `/question/${id}`;
    case "source": return `/library/source/${id}`;
    case "project": return `/research/${id}`;
    default: return "#";
  }
}

const relLabel = (id: string, dir: "out" | "in" | undefined) => {
  const r = LINK_RELATIONS.find((x) => x.id === id)?.label ?? id.replace(/_/g, " ");
  return dir === "in" ? `← ${r}` : r;
};

/** Typed, labelled relationships between research objects, created by hand. */
export function Connections({ type, id, initial }: { type: ObjectType; id: string; initial?: LinkT[] }) {
  const [links, setLinks] = useState<LinkT[]>(initial ?? []);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ kind: string; id: string; title: string }[]>([]);
  const [target, setTarget] = useState<{ kind: string; id: string; title: string } | null>(null);
  const [relation, setRelation] = useState("related_to");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const r = await api<{ links: LinkT[] }>(`/api/links?type=${type}&id=${id}`);
    setLinks(r.links);
  }, [type, id]);

  useEffect(() => {
    if (!initial) void load();
  }, [initial, load]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await api<{ hits: { kind: string; id: string; title: string }[] }>(`/api/search?q=${encodeURIComponent(q)}&kinds=cluster,question,source,project&limit=8`);
      setHits(r.hits.filter((h) => !(h.kind === type && h.id === id)));
    }, 250);
    return () => clearTimeout(t);
  }, [q, type, id]);

  async function create() {
    if (!target) return;
    await api("/api/links", "POST", { fromType: type, fromId: id, toType: target.kind, toId: target.id, relation, note: note || undefined });
    setAdding(false);
    setTarget(null);
    setQ("");
    setNote("");
    void load();
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="eyebrow">Connections</div>
        <button className="btn-ghost !px-1.5 !text-[12px]" onClick={() => setAdding((a) => !a)}>
          <Icon name="link" size={13} /> Connect
        </button>
      </div>
      {links.length === 0 && !adding && <p className="text-[12.5px] text-muted">No connections yet. Link related questions, precedents, supporting or contradicting material.</p>}
      <ul className="space-y-1.5">
        {links.map((l) => (
          <li key={l.id} className="group flex items-start gap-2 text-[12.5px]">
            <div className="min-w-0 flex-1">
              <span className="text-muted">{relLabel(l.relation, l.direction)} · {TYPE_LABEL[l.otherType ?? ""]}</span>
              <Link href={hrefFor(l.otherType!, l.otherId!)} className="block truncate text-ink-2 hover:text-ink hover:underline">{l.otherTitle}</Link>
              {l.note && <span className="block text-muted">“{l.note}”</span>}
            </div>
            <button className="btn-ghost !px-1 opacity-0 group-hover:opacity-100" title="Remove connection" onClick={async () => { await api("/api/links", "DELETE", { id: l.id }); void load(); }}>
              <Icon name="x" size={12} />
            </button>
          </li>
        ))}
      </ul>
      {adding && (
        <div className="mt-2 space-y-2 rounded-md border border-line p-2.5">
          <select className="input !py-1 text-[12.5px]" value={relation} onChange={(e) => setRelation(e.target.value)}>
            {LINK_RELATIONS.map((r) => <option key={r.id} value={r.id}>This {r.label}…</option>)}
          </select>
          {target ? (
            <div className="flex items-center justify-between gap-2 rounded bg-surface-2 px-2 py-1 text-[12.5px]">
              <span className="truncate"><span className="text-muted">{TYPE_LABEL[target.kind]}:</span> {target.title}</span>
              <button className="btn-ghost !px-1" onClick={() => setTarget(null)}><Icon name="x" size={12} /></button>
            </div>
          ) : (
            <>
              <input className="input !py-1 text-[12.5px]" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stories, questions, sources, projects…" autoFocus />
              {hits.length > 0 && (
                <ul className="max-h-48 overflow-auto rounded border border-line">
                  {hits.map((h) => (
                    <li key={h.kind + h.id}>
                      <button className="block w-full truncate px-2 py-1 text-left text-[12.5px] hover:bg-surface-2" onClick={() => setTarget(h)}>
                        <span className="text-muted">{TYPE_LABEL[h.kind]}:</span> {h.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <input className="input !py-1 text-[12.5px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why? (optional)" />
          <div className="flex justify-end gap-1">
            <button className="btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn-primary !py-1" disabled={!target} onClick={create}>Connect</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Add an item to an existing or new project. */
export function AddToProject({ itemType, itemId, current = [] }: { itemType: "cluster" | "question" | "source"; itemId: string; current?: { id: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [inProjects, setIn] = useState(current);
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (open) void api<{ projects: { id: string; title: string }[] }>("/api/projects").then((r) => setProjects(r.projects));
  }, [open]);

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {inProjects.map((p) => (
          <Link key={p.id} href={`/research/${p.id}`} className="chip hover:border-accent hover:text-accent">
            <Icon name="research" size={12} /> {p.title}
          </Link>
        ))}
        <button className="btn !py-1 !text-[12px]" onClick={() => setOpen((o) => !o)}>
          <Icon name="plus" size={13} /> Add to project
        </button>
      </div>
      {open && (
        <div className="absolute left-0 top-9 z-20 w-72 rounded-lg border border-line bg-surface p-2.5 shadow-lg">
          <ul className="max-h-52 overflow-auto">
            {projects.filter((p) => !inProjects.some((x) => x.id === p.id)).map((p) => (
              <li key={p.id}>
                <button
                  className="block w-full truncate rounded px-2 py-1.5 text-left text-[13px] hover:bg-surface-2"
                  onClick={async () => {
                    await api(`/api/projects/${p.id}/items`, "POST", { itemType, itemId });
                    setIn((x) => [...x, p]);
                    setOpen(false);
                  }}
                >
                  {p.title}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-1.5 border-t border-line pt-2">
            <input className="input !py-1 text-[13px]" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New project title" />
            <button
              className="btn-primary !py-1"
              disabled={!title.trim()}
              onClick={async () => {
                const r = await api<{ project: { id: string; title: string } }>("/api/projects", "POST", { title, item: { type: itemType, id: itemId } });
                setIn((x) => [...x, r.project]);
                setTitle("");
                setOpen(false);
              }}
            >
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
