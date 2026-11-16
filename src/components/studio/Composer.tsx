"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { InlineIdeas } from "./InlineIdeas";
import { PitchCard } from "./PitchCard";
import { CONTENT_FORMATS } from "@/lib/ideation/formats";
import type { Idea, Inspiration } from "@/lib/ideation/repo";

type Result =
  | { kind: "pitch"; idea: Idea }
  | { kind: "inspiration"; item: Inspiration; metadataFound: boolean }
  | { kind: "topic"; topic: string };

const INTENTS: [string, string][] = [
  ["other-angles", "Find other angles"],
  ["recreate-format", "Recreate this style"],
  ["cover-topic", "Cover this topic"],
  ["dig-deeper", "Dig deeper"],
];

/**
 * One box for everything you bring: a link (saved as inspiration), your own idea
 * (expanded into angles, outline, proposal) or a topic (ideas about it). Results
 * appear right here.
 */
export function Composer() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [format, setFormat] = useState("youtube-long");
  const [intent, setIntent] = useState("other-angles");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const isLink = /^https?:\/\/\S+$/i.test(text.trim().split(/\s+/)[0] ?? "");

  const saveInspiration = async () => {
    setBusy(true);
    setErr(null);
    try {
      const parts = text.trim().split(/\s+/);
      const url = parts[0];
      const note = parts.slice(1).join(" ") || undefined;
      const r = await api<{ inspiration: Inspiration; metadataFound: boolean }>("/api/inspirations", "POST", { url, note, intents: [intent] });
      setResult({ kind: "inspiration", item: r.inspiration, metadataFound: r.metadataFound });
      setText("");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const savePitch = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ idea: Idea }>("/api/ideas/pitch", "POST", { text, format });
      setResult({ kind: "pitch", idea: r.idea });
      setText("");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-4">
      <textarea
        className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink outline-none placeholder:text-muted"
        rows={text.length > 120 ? 5 : 2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste a link (YouTube, reel, article, paper…), write your own idea — any format — or type a topic you want ideas about."
      />
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {isLink ? (
          <>
            <select className="input !w-auto !py-1 text-[13px]" value={intent} onChange={(e) => setIntent(e.target.value)}>
              {INTENTS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
            </select>
            <button className="btn-primary" disabled={busy} onClick={saveInspiration}>
              <Icon name="bookmark" size={14} /> {busy ? "Reading link…" : "Save as inspiration"}
            </button>
            <span className="text-[12px] text-muted">Add words after the link to say why it inspires you.</span>
          </>
        ) : (
          <>
            <select className="input !w-auto !py-1 text-[13px]" value={format} onChange={(e) => setFormat(e.target.value)} title="Format for your idea">
              {CONTENT_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <button className="btn-primary" disabled={busy || text.trim().length < 8} onClick={savePitch} title="Save it as your idea, then expand it into angles, outline, next steps and a proposal">
              <Icon name="edit" size={14} /> Develop my idea
            </button>
            <button className="btn" disabled={text.trim().length < 3} onClick={() => { setResult({ kind: "topic", topic: text.trim() }); }}>
              <Icon name="bulb" size={14} /> Get ideas about this
            </button>
          </>
        )}
      </div>
      {err && <p className="mt-2 text-[12.5px] text-bad">{err}</p>}

      {result && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="eyebrow">{result.kind === "pitch" ? "Your idea" : result.kind === "inspiration" ? "Saved inspiration" : `Ideas about “${result.topic}”`}</span>
            <button className="btn-ghost !px-1" onClick={() => setResult(null)}><Icon name="x" size={13} /></button>
          </div>
          {result.kind === "pitch" && <PitchCard initial={result.idea} />}
          {result.kind === "inspiration" && (
            <div className="space-y-2">
              <div className="rounded-md bg-surface-2 px-3 py-2 text-[13px]">
                <div className="font-medium text-ink">{result.item.title ?? result.item.url}</div>
                <div className="text-[12px] text-muted">
                  {result.metadataFound ? "Public details read." : "That site shares nothing publicly — your note carries the meaning."}
                  {result.item.matchedClusters.length ? ` Matched ${result.item.matchedClusters.length} related stories.` : ""}
                </div>
              </div>
              <InlineIdeas label="Get ideas from this" payload={{ inspirationId: result.item.id, clusterIds: result.item.matchedClusters.length ? result.item.matchedClusters.slice(0, 5) : undefined }} />
            </div>
          )}
          {result.kind === "topic" && <InlineIdeas label={`Get ideas about “${result.topic.slice(0, 40)}”`} payload={{ focus: `Ideas about: ${result.topic}` }} count={5} />}
        </div>
      )}
    </section>
  );
}
