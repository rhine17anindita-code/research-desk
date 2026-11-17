"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { AiButton } from "./AiButton";
import { ScriptWorkbench } from "./ScriptWorkbench";
import type { Dials, Preset } from "@/lib/voice-shared";
import { CONTENT_TYPES, DOC_KEYS, PLATFORMS, PROD_STAGES, progressOf, type Production, type ProductionDocs } from "@/lib/production-shared";

const DOC_LABEL: Record<(typeof DOC_KEYS)[number], string> = { script: "Script", shots: "Shot list", thumbnail: "Thumbnail & titles", cutdowns: "Cut-downs", captions: "Captions" };
const DOC_HINT: Record<(typeof DOC_KEYS)[number], string> = {
  script: "Write it step by step in your voice (set up in Voice Lab): real material, hooks, outline, draft — then select any passage to rewrite it.",
  shots: "Every shot in order, where the visual comes from, on-screen text and timing.",
  thumbnail: "Three thumbnail concepts and title options.",
  cutdowns: "Vertical clips to cut from the long piece, each with its own hook.",
  captions: "YouTube description with chapters, plus Instagram, Facebook and TikTok captions, hashtags and a pinned comment.",
};
const PLATFORM_LABEL: Record<string, string> = { youtube: "YouTube", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" };

/** The content side of a project: type, stage, date, platforms, and the working documents. */
export function ProductionPanel({ initial, presets = [], voice }: { initial: Production; presets?: string[]; voice?: { dials: Dials; presets: Preset[] } }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [tab, setTab] = useState<(typeof DOC_KEYS)[number]>("script");
  const [draft, setDraft] = useState<ProductionDocs>(initial.docs);
  const [saved, setSaved] = useState<string | null>(null);

  const save = async (patch: Record<string, unknown>) => {
    const r = await api<{ production: Production }>(`/api/projects/${p.projectId}/production`, "PATCH", patch);
    setP(r.production);
    setSaved("Saved");
    setTimeout(() => setSaved(null), 1500);
  };
  const onAi = (res: Record<string, unknown>) => {
    const prod = res.data as Production | undefined;
    if (prod?.docs) {
      setP(prod);
      setDraft(prod.docs);
    }
    router.refresh();
  };
  const progress = progressOf(p.stage, draft);
  const stageIdx = PROD_STAGES.findIndex((s) => s.id === p.stage);

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line bg-accent-soft/50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-[18px] font-semibold">Production</h2>
          <select className="input !w-auto !rounded-full !py-0.5 text-[12.5px]" value={p.contentType} onChange={(e) => save({ contentType: e.target.value })}>
            {CONTENT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <label className="flex items-center gap-1 text-[12.5px] text-muted">
            Goes out
            <input type="date" className="input !w-auto !py-0.5 text-[12.5px]" value={p.publishDate ?? ""} onChange={(e) => save({ publishDate: e.target.value || null })} />
          </label>
          <span className="ml-auto text-[12px] text-muted">{saved}</span>
          <span className="font-semibold tabular-nums text-accent">{progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {PROD_STAGES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => save({ stage: s.id })}
              className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium transition-colors ${i === stageIdx ? "bg-accent text-white" : i < stageIdx ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted hover:text-ink"}`}
            >
              {i < stageIdx ? "✓ " : ""}{s.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px]">
          {PLATFORMS.map((pl) => {
            const on = p.platforms.includes(pl);
            return (
              <button key={pl} className={on ? "chip-accent" : "chip"} onClick={() => save({ platforms: on ? p.platforms.filter((x) => x !== pl) : [...p.platforms, pl] })}>
                {PLATFORM_LABEL[pl]}
              </button>
            );
          })}
          {(p.contentType === "series" || p.seriesName) && <Field label="Series" value={p.seriesName} onSave={(v) => save({ seriesName: v })} />}
          {(["interview", "podcast"].includes(p.contentType) || p.guest) && <Field label="Guest" value={p.guest} onSave={(v) => save({ guest: v })} />}
          {(p.contentType === "sponsored" || p.sponsor) && <Field label="Sponsor" value={p.sponsor} onSave={(v) => save({ sponsor: v })} />}
          {p.stage === "live" && <Field label="Link" value={p.publishedUrl} onSave={(v) => save({ publishedUrl: v })} />}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-2">
        {DOC_KEYS.map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px shrink-0 border-b-2 px-2.5 py-1.5 text-[13px] font-medium ${tab === k ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {DOC_LABEL[k]}{(draft[k] ?? "").trim().length > 20 ? " ✓" : ""}
          </button>
        ))}
      </div>
      <div className="p-4">
        <p className="mb-2 text-[12.5px] text-muted">{DOC_HINT[tab]}</p>
        {tab === "script" ? (
          <ScriptWorkbench key={p.updatedAt.slice(0, 16)} p={p} presets={presets} voice={voice} onProduction={(prod) => { setP(prod); setDraft(prod.docs); router.refresh(); }} />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <AiButton label="Make shot list, thumbnails, cut-downs & captions" endpoint={`/api/projects/${p.projectId}/package`} payload={{ regenerate: !!draft[tab]?.trim() }} confirm="always" runningLabel="Packaging…" onResult={onAi} />
            </div>
            <textarea
              className="input min-h-[320px] font-mono text-[13px] leading-relaxed"
              value={draft[tab] ?? ""}
              onChange={(e) => setDraft({ ...draft, [tab]: e.target.value })}
              onBlur={() => (draft[tab] ?? "") !== (p.docs[tab] ?? "") && save({ docs: { [tab]: draft[tab] ?? "" } })}
              placeholder="Draft it from the script, or write your own…"
            />
          </>
        )}
      </div>
    </section>
  );
}

function Field({ label, value, onSave }: { label: string; value: string | null; onSave: (v: string) => void }) {
  const [v, setV] = useState(value ?? "");
  return (
    <label className="flex items-center gap-1 text-muted">
      {label}
      <input className="input !w-40 !py-0.5 text-[12.5px]" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== (value ?? "") && onSave(v)} />
    </label>
  );
}
