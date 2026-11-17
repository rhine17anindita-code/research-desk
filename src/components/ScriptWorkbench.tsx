"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { api } from "./api";
import { Icon } from "./Icon";
import { AiButton } from "./AiButton";
import type { Production, ProductionDocs } from "@/lib/production-shared";
import { BLEND, DIALS, type Dials, type Preset } from "@/lib/voice-shared";

const REWRITES = ["Punchier", "More personal", "Simpler", "More Banglish", "Funnier", "More critical", "Shorter", "More emotional", "Sound more like me"];

/**
 * The Script tab: write in steps, in your voice.
 * 0 full articles (free) → 1 hooks → 2 outline → 3 draft → edit, and rewrite any selected passage.
 */
export function ScriptWorkbench({ p, presets, voice, onProduction }: { p: Production; presets: string[]; voice?: { dials: Dials; presets: Preset[] }; onProduction: (p: Production) => void }) {
  const [docs, setDocs] = useState<ProductionDocs>(p.docs);
  const [preset, setPreset] = useState("");
  const [direction, setDirection] = useState("");
  const [deep, setDeep] = useState<string | null>(null);
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null);
  const [custom, setCustom] = useState("");
  const [options, setOptions] = useState<string[] | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);

  const apply = (r: Record<string, unknown>) => {
    const prod = r.data as Production | undefined;
    if (prod?.docs) {
      setDocs(prod.docs);
      onProduction(prod);
    }
  };
  const saveDoc = async (patch: ProductionDocs) => {
    const r = await api<{ production: Production }>(`/api/projects/${p.projectId}/production`, "PATCH", { docs: patch });
    onProduction(r.production);
  };
  const hooks = (docs.hooks ?? "").split(/\n(?=\d+\. )/).map((h) => h.trim()).filter(Boolean);
  const selected = sel && docs.script ? docs.script.slice(sel.start, sel.end) : "";
  const common = { preset: preset || undefined, direction: direction || undefined };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2/60 px-3 py-2 text-[12.5px]">
        <span className="text-muted">Voice:</span>
        <select className="input !w-auto !py-0.5 text-[12.5px]" value={preset} onChange={(e) => setPreset(e.target.value)}>
          <option value="">Channel default dials</option>
          {presets.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <ProjectDials docs={docs} voice={voice} preset={preset} onSave={(json) => { setDocs({ ...docs, dials: json }); saveDoc({ dials: json }); }} />
        <Link href="/voice" className="text-accent hover:underline">Voice Lab →</Link>
        <input className="input !w-full !py-1 text-[12.5px] sm:!w-80" value={direction} onChange={(e) => setDirection(e.target.value)} placeholder="Direction (optional): angle, tone, length, what to include…" />
      </div>

      {/* Step 0 + 1 */}
      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        <div className="text-[12.5px]">
          <div className="font-semibold text-ink">0 · Real material</div>
          <p className="text-muted">Pull the full text of every article this project uses, instead of headline blurbs. Free.</p>
          <button
            className="btn mt-1 !py-1 !text-[12.5px]"
            onClick={async () => {
              setDeep("Reading the articles…");
              const r = await api<{ result: { checked: number; deepened: number } }>(`/api/projects/${p.projectId}/script-steps`, "POST", { step: "deepen" });
              setDeep(r.result.checked ? `Full text added for ${r.result.deepened} of ${r.result.checked} sources${r.result.deepened < r.result.checked ? " (the rest are paywalled or blocked)" : ""}.` : "Nothing to deepen — add stories or sources to the project first.");
            }}
          >
            Get full articles
          </button>
          {deep && <p className="mt-1 text-muted">{deep}</p>}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] font-semibold text-ink">1 · Hooks</span>
            <AiButton size="sm" label={hooks.length ? "New hooks" : "Give me 5 hooks"} endpoint={`/api/projects/${p.projectId}/script-steps`} payload={{ step: "hooks", ...common }} confirm="always" runningLabel="Writing hooks…" onResult={apply} />
          </div>
          {hooks.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {hooks.map((h, i) => {
                const line = h.replace(/^\d+\.\s*/, "").split("\n")[0];
                const chosen = docs.hook === line;
                return (
                  <li key={i} className={`rounded-lg px-2.5 py-1.5 text-[13px] ${chosen ? "bg-accent-soft" : "bg-surface-2/50"}`}>
                    <div className="text-ink">{line}</div>
                    <div className="flex items-center justify-between gap-2 text-[11.5px] text-muted">
                      <span>{h.split("\n")[1]?.trim().replace(/^\(|\)$/g, "")}</span>
                      <button className={chosen ? "font-semibold text-accent" : "text-accent hover:underline"} onClick={() => { setDocs({ ...docs, hook: line }); saveDoc({ hook: line }); }}>{chosen ? "✓ Using this" : "Use this"}</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <input className="input mt-2 !py-1 text-[12.5px]" value={docs.hook ?? ""} onChange={(e) => setDocs({ ...docs, hook: e.target.value })} onBlur={() => saveDoc({ hook: docs.hook ?? "" })} placeholder="…or write your own opening line" />
        </div>
      </div>

      {/* Step 2 */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] font-semibold text-ink">2 · Outline</span>
          <AiButton size="sm" label={docs.outline?.trim() ? "Re-plan the outline" : "Plan the beats"} endpoint={`/api/projects/${p.projectId}/script-steps`} payload={{ step: "outline", hook: docs.hook, ...common }} confirm="always" runningLabel="Planning…" onResult={apply} />
          <span className="text-[11.5px] text-muted">Edit it freely — the draft follows it.</span>
        </div>
        <textarea className="input mt-2 min-h-[140px] font-mono text-[12.5px] leading-relaxed" value={docs.outline ?? ""} onChange={(e) => setDocs({ ...docs, outline: e.target.value })} onBlur={() => saveDoc({ outline: docs.outline ?? "" })} placeholder="## Cold open&#10;- …" />
      </div>

      {/* Step 3 */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] font-semibold text-ink">3 · Draft</span>
          <AiButton
            size="sm"
            label={docs.script?.trim() ? "Rewrite the whole draft" : "Write the draft in my voice"}
            endpoint={`/api/projects/${p.projectId}/script`}
            payload={{ regenerate: !!docs.script?.trim(), ...common }}
            confirm="always"
            runningLabel="Writing in your voice…"
            onResult={apply}
          />
          <span className="text-[11.5px] text-muted">Your edits to the draft teach future drafts.</span>
        </div>

        {selected.trim().length > 3 && (
          <div className="mt-2 rounded-xl border border-accent/30 bg-accent-soft/40 px-3 py-2 text-[12.5px]">
            <div className="mb-1 text-muted">Rewrite the selected {selected.trim().split(/\s+/).length} words:</div>
            <div className="flex flex-wrap gap-1.5">
              {REWRITES.map((how) => (
                <AiButton key={how} size="sm" variant="ghost" label={how} endpoint={`/api/projects/${p.projectId}/script-steps`} payload={{ step: "rewrite", selection: selected, instruction: how, preset: preset || undefined }} confirm="auto" runningLabel="…" onResult={(r) => setOptions((r.data as { options: string[] }).options)} />
              ))}
              <input className="input !w-48 !py-0.5 text-[12px]" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Your own instruction" />
              {custom.trim() && <AiButton size="sm" variant="ghost" label="Go" endpoint={`/api/projects/${p.projectId}/script-steps`} payload={{ step: "rewrite", selection: selected, instruction: custom, preset: preset || undefined }} confirm="auto" runningLabel="…" onResult={(r) => setOptions((r.data as { options: string[] }).options)} />}
            </div>
            {options && (
              <ul className="mt-2 space-y-1.5">
                {options.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-lg bg-surface px-2.5 py-1.5">
                    <span className="flex-1 whitespace-pre-line text-ink">{o}</span>
                    <button
                      className="btn !py-0.5 !text-[12px]"
                      onClick={() => {
                        if (!sel || !docs.script) return;
                        const next = docs.script.slice(0, sel.start) + o + docs.script.slice(sel.end);
                        setDocs({ ...docs, script: next });
                        saveDoc({ script: next });
                        setOptions(null);
                        setSel(null);
                      }}
                    >
                      Use
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <textarea
          ref={ta}
          className="input mt-2 min-h-[420px] font-mono text-[13px] leading-relaxed"
          value={docs.script ?? ""}
          onChange={(e) => setDocs({ ...docs, script: e.target.value })}
          onSelect={(e) => {
            const t = e.currentTarget;
            if (t.selectionEnd - t.selectionStart > 3) {
              setSel({ start: t.selectionStart, end: t.selectionEnd });
              setOptions(null);
            }
          }}
          onBlur={() => (docs.script ?? "") !== (p.docs.script ?? "") && saveDoc({ script: docs.script ?? "" })}
          placeholder="Write here, or go through the steps above. Select any passage to rewrite it."
        />
      </div>
    </div>
  );
}

/** This script's own dials: start from the channel (or the chosen preset), change anything for this piece only. */
function ProjectDials({ docs, voice, preset, onSave }: { docs: ProductionDocs; voice?: { dials: Dials; presets: Preset[] }; preset: string; onSave: (json: string) => void }) {
  const base = { ...(voice?.dials ?? {}), ...(voice?.presets.find((x) => x.name === preset)?.dials ?? {}) };
  const own = (() => {
    try {
      return docs.dials ? (JSON.parse(docs.dials) as Dials) : null;
    } catch {
      return null;
    }
  })();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<Dials>({ ...base, ...(own ?? {}) });
  const commit = () => onSave(JSON.stringify(d));
  return (
    <span className="relative">
      <button className={own ? "chip-accent" : "chip"} onClick={() => setOpen((o) => !o)}>{own ? "Dials: this script's own" : "Dials for this script"}</button>
      {open && (
        <div className="absolute left-0 top-8 z-20 w-[min(92vw,640px)] rounded-2xl border border-line bg-surface p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between text-[12px]">
            <span className="text-muted">Changes here apply to this project only. The channel&apos;s defaults stay as they are.</span>
            <button className="btn-ghost !px-1 !text-[12px]" onClick={() => setOpen(false)}>Close</button>
          </div>
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {[BLEND, ...DIALS].map((x) => (
              <label key={x.id} className="block text-[11.5px]">
                <div className="flex justify-between text-muted"><span>{x.left}</span><span>{x.right}</span></div>
                <input type="range" min={0} max={100} value={d[x.id] ?? 50} onChange={(e) => setD({ ...d, [x.id]: Number(e.target.value) })} onMouseUp={commit} onTouchEnd={commit} onKeyUp={commit} className="w-full accent-[var(--color-accent)]" />
              </label>
            ))}
          </div>
          {own && (
            <button className="btn mt-2 !py-1 !text-[12px]" onClick={() => { setD(base); onSave(""); }}>Back to the channel&apos;s dials</button>
          )}
        </div>
      )}
    </span>
  );
}
