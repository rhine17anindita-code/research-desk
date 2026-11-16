"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { AiButton } from "../AiButton";
import { GeneratePanel } from "./GeneratePanel";
import { timeAgo } from "@/lib/format";
import type { Inspiration, InspirationIntent } from "@/lib/ideation/repo";

const INTENTS: { id: InspirationIntent; label: string }[] = [
  { id: "recreate-format", label: "Recreate this format/style" },
  { id: "cover-topic", label: "Talk about this topic" },
  { id: "dig-deeper", label: "Dig deeper into it" },
  { id: "other-angles", label: "Find other angles" },
];

const KIND_LABEL: Record<string, string> = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", x: "X", paper: "Paper", article: "Article", text: "Note", other: "Link" };

export function AddInspiration() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [intents, setIntents] = useState<InspirationIntent[]>(["other-angles"]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="card p-4">
      <div className="eyebrow mb-2">Add inspiration</div>
      <input className="input mb-2" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a link — YouTube, Instagram reel, TikTok, X post, paper, article… (optional)" />
      <textarea
        className="input mb-2 min-h-[64px] text-[13px]"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Why does it inspire you? e.g. “love how he opens with a map and a mystery”, “nobody has explained this for Bangladesh”, or just a topic idea."
      />
      <div className="mb-3 flex flex-wrap gap-1">
        {INTENTS.map((i) => (
          <button
            key={i.id}
            onClick={() => setIntents((x) => (x.includes(i.id) ? x.filter((y) => y !== i.id) : [...x, i.id]))}
            className={`chip ${intents.includes(i.id) ? "border-accent bg-accent-soft text-accent" : ""}`}
          >
            {i.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          className="btn-primary"
          disabled={busy || (!url.trim() && !note.trim())}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            try {
              const r = await api<{ metadataFound: boolean; inspiration: Inspiration }>("/api/inspirations", "POST", { url: url || undefined, note: note || undefined, intents });
              setMsg(
                url && !r.metadataFound
                  ? "Saved. That site didn't share its title or description publicly, so your note carries the meaning — add a sentence about it if you can."
                  : `Saved${r.inspiration.matchedClusters.length ? ` — matched ${r.inspiration.matchedClusters.length} related stor${r.inspiration.matchedClusters.length === 1 ? "y" : "ies"} in your database` : ""}.`,
              );
              setUrl("");
              setNote("");
              router.refresh();
            } catch (e) {
              setMsg((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : "Save inspiration"}
        </button>
        <span className="text-[12px] text-muted">Free: reads the link&apos;s public title/description and finds related stories.</span>
      </div>
      {msg && <p className="mt-2 text-[12.5px] text-muted">{msg}</p>}
    </div>
  );
}

export function InspirationItem({ item, stories }: { item: Inspiration; stories: { id: string; headline: string }[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(item.note ?? "");
  const [showGen, setShowGen] = useState(false);
  return (
    <li id={item.id} className="card overflow-hidden">
      <div className="flex gap-3 p-4">
        {item.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnail} alt="" className="hidden h-20 w-32 shrink-0 rounded object-cover sm:block" referrerPolicy="no-referrer" />
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
            <span className="font-semibold uppercase tracking-wide">{KIND_LABEL[item.kind] ?? item.kind}</span>
            {item.author && <span>· {item.author}</span>}
            <span>· {timeAgo(item.createdAt)}</span>
            <button
              className="btn-ghost ml-auto !px-1"
              title="Delete"
              onClick={async () => {
                if (!confirm("Remove this inspiration?")) return;
                await api(`/api/inspirations/${item.id}`, "DELETE");
                router.refresh();
              }}
            >
              <Icon name="trash" size={13} />
            </button>
          </div>
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer" className="font-medium leading-snug text-ink hover:underline">
              {item.title ?? item.url} <Icon name="external" size={11} className="inline text-muted" />
            </a>
          ) : (
            <div className="font-medium text-ink">{item.title ?? "Note"}</div>
          )}
          {item.description && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-2">{item.description}</p>}
          {editing ? (
            <div className="mt-2">
              <textarea className="input min-h-[60px] text-[13px]" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="mt-1 flex gap-1">
                <button className="btn-primary !py-1" onClick={async () => { await api(`/api/inspirations/${item.id}`, "PATCH", { note }); setEditing(false); router.refresh(); }}>Save note</button>
                <button className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="mt-1.5 block text-left text-[13px] text-ink-2" onClick={() => setEditing(true)} title="Edit your note">
              {item.note ? <span>“{item.note}”</span> : <span className="text-muted">+ Add why it inspires you</span>}
            </button>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {item.intents.map((i) => <span key={i} className="chip">{INTENTS.find((x) => x.id === i)?.label ?? i}</span>)}
          </div>
          {item.analysis && (
            <div className="mt-2 rounded-md border border-ai/20 bg-ai-soft/40 p-2.5 text-[12.5px] text-ink-2">
              <div className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ai">Why it works (AI, from title/description/your note)</div>
              <p>{item.analysis.whyItWorks}</p>
              <p className="mt-1"><b className="font-medium">Hook style:</b> {item.analysis.hookStyle} · <b className="font-medium">Format:</b> {item.analysis.format}</p>
              {item.analysis.patterns.length > 0 && <ul className="mt-1 list-disc pl-5">{item.analysis.patterns.map((p, i) => <li key={i}>{p}</li>)}</ul>}
            </div>
          )}
          {stories.length > 0 && (
            <div className="mt-2 text-[12.5px]">
              <span className="text-muted">Related in your stories: </span>
              {stories.map((s, i) => (
                <span key={s.id}>
                  {i > 0 && " · "}
                  <Link href={`/story/${s.id}`} className="text-accent hover:underline">{s.headline}</Link>
                </span>
              ))}
            </div>
          )}
          <div className="mt-2.5 flex flex-wrap items-start gap-2">
            {!item.analysis && <AiButton label="Why does it work?" size="sm" endpoint={`/api/inspirations/${item.id}/analyze`} onResult={() => router.refresh()} />}
            <button className="btn !py-1 !text-[12px]" onClick={() => setShowGen((s) => !s)}>
              <Icon name="bulb" size={13} /> Ideas from this
            </button>
          </div>
          {showGen && (
            <div className="mt-2">
              <GeneratePanel inspirationId={item.id} clusterIds={stories.length ? stories.map((s) => s.id) : undefined} label="Generate ideas inspired by this" />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
