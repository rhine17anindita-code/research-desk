"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { Icon } from "./Icon";
import { RefreshButton } from "./FeedActions";
import type { AppSettings, PipelineStage } from "@/lib/settings-defaults";
import type { AiStatus } from "@/lib/ai/service";
import { fmtDate, timeAgo, usd } from "@/lib/format";

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

interface FeedRow { id: string; name: string; url: string; region: string; category: string; enabled: number; priority: number; last_status: string | null; last_error: string | null; last_fetched_at: string | null; last_item_count: number | null; articles: number }

export function FeedsSettings({ feeds, hasSample, runs, scheduleMinutes }: { feeds: FeedRow[]; hasSample: boolean; runs: { started_at: string; feeds_ok: number; feeds_failed: number; articles_new: number; articles_duplicate: number; clusters_new: number; trigger: string }[]; scheduleMinutes: number }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const patch = async (id: string, body: Record<string, unknown>) => {
    await api(`/api/feeds/${id}`, "PATCH", body);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="text-[13px] text-ink-2">
          <p>{feeds.filter((f) => f.enabled).length} of {feeds.length} feeds enabled. Only headlines, links, dates and publisher descriptions are stored; full articles are never scraped.</p>
          <p className="text-muted">
            Automatic refresh: {scheduleMinutes >= 5 ? `every ${scheduleMinutes} minutes while the server runs` : "off (set INGEST_INTERVAL_MINUTES in .env.local)"}.
          </p>
        </div>
        <RefreshButton label="Refresh all now" />
      </section>

      <section className="card p-4">
        <div className="eyebrow mb-2">Add a feed</div>
        <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_auto]">
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/rss.xml" />
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" />
          <input className="input" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Region (e.g. South Asia)" />
          <button
            className="btn-primary"
            disabled={!url || busy}
            onClick={async () => {
              setErr(null);
              setBusy(true);
              try {
                await api("/api/feeds", "POST", { url, name, region });
                setUrl("");
                setName("");
                router.refresh();
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Checking…" : "Add feed"}
          </button>
        </div>
        {err && <p className="mt-1.5 text-[12px] text-bad">{err}</p>}
        <p className="mt-1.5 text-[12px] text-muted">The feed is fetched once to confirm it works. Use RSS or Atom feeds publishers offer publicly.</p>
      </section>

      <section>
        <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-lg border border-line bg-surface text-[13px]">
          <thead>
            <tr className="text-left text-[11.5px] uppercase tracking-wide text-muted">
              <th className="border-b border-line px-3 py-2">On</th>
              <th className="border-b border-line px-3 py-2">Feed</th>
              <th className="hidden border-b border-line px-3 py-2 md:table-cell">Status</th>
              <th className="border-b border-line px-3 py-2" title="Ranking weight of this source: 0 = ignore, 1 = normal, 3 = strongly prefer">Priority</th>
              <th className="border-b border-line px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {feeds.map((f) => (
              <tr key={f.id} className={f.enabled ? "" : "opacity-60"}>
                <td className="border-b border-line px-3 py-2"><input type="checkbox" checked={!!f.enabled} onChange={(e) => patch(f.id, { enabled: e.target.checked })} /></td>
                <td className="border-b border-line px-3 py-2">
                  <div className="font-medium text-ink">{f.name}</div>
                  <div className="text-[11.5px] text-muted">{f.region} · {f.category} · {f.articles} articles</div>
                </td>
                <td className="hidden border-b border-line px-3 py-2 text-[12px] md:table-cell">
                  {f.last_status === "ok" && <span className="text-ok">OK · {f.last_item_count} items · {timeAgo(f.last_fetched_at)}</span>}
                  {f.last_status === "error" && <span className="text-bad" title={f.last_error ?? ""}>Failed: {(f.last_error ?? "").slice(0, 70)}</span>}
                  {!f.last_status && <span className="text-muted">Not fetched yet</span>}
                </td>
                <td className="border-b border-line px-3 py-2">
                  <select className="input !w-auto !py-0.5 text-[12px]" value={f.priority} onChange={(e) => patch(f.id, { priority: Number(e.target.value) })}>
                    {[0, 0.5, 1, 1.5, 2, 3].map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td className="border-b border-line px-3 py-2 text-right">
                  <button className="btn-ghost !px-1" title="Remove feed (collected articles are kept)" onClick={async () => { if (confirm(`Remove ${f.name}? Articles already collected are kept.`)) { await api(`/api/feeds/${f.id}`, "DELETE"); router.refresh(); } }}>
                    <Icon name="trash" size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="eyebrow mb-2">Recent refreshes</div>
          <ul className="space-y-1 text-[12.5px] text-ink-2">
            {runs.map((r, i) => (
              <li key={i}>{fmtDate(r.started_at, true)} · {r.trigger} · {r.feeds_ok} ok, {r.feeds_failed} failed · +{r.articles_new} articles ({r.articles_duplicate} duplicates skipped), {r.clusters_new} new stories</li>
            ))}
            {runs.length === 0 && <li className="text-muted">None yet.</li>}
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-2">Sample data</div>
          {hasSample ? (
            <button className="btn" onClick={async () => { await api("/api/sample", "DELETE"); router.refresh(); }}>Remove fictional sample stories</button>
          ) : (
            <button className="btn" onClick={async () => { await api("/api/sample", "POST"); router.refresh(); }}>Load fictional sample stories (offline demo)</button>
          )}
          <p className="mt-1 text-[12px] text-muted">Sample stories concern invented places, use example.org links and are labelled “Sample” everywhere.</p>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Personalisation
// ---------------------------------------------------------------------------

interface SignalRow { id: string; label: string; description: string; cues: string[]; weight: number; learned: number; enabled: number; builtin: number }
interface RuleRow { id: string; name: string; action: string; field: string; pattern: string; weight: number; enabled: number }

export function PersonalisationSettings({ signals, rules, regions, regionWeights, windowHours, topTerms }: { signals: SignalRow[]; rules: RuleRow[]; regions: string[]; regionWeights: Record<string, number>; windowHours: number; topTerms: { term: string; weight: number }[] }) {
  const router = useRouter();
  const [newSig, setNewSig] = useState({ label: "", description: "", cues: "" });
  const [rule, setRule] = useState({ action: "boost", field: "any", pattern: "", weight: 3 });
  const [rw, setRw] = useState(regionWeights);
  const [editingCues, setEditingCues] = useState<string | null>(null);
  const [cueText, setCueText] = useState("");

  const patchSignal = async (id: string, body: Record<string, unknown>) => {
    await api(`/api/signals/${id}`, "PATCH", body);
    router.refresh();
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-serif text-[19px] font-semibold">Editorial signals</h2>
        <p className="mb-3 text-[13px] text-muted">
          What makes a story worth your time, independent of topic. <b>Weight</b> is your setting; <b>learned</b> moves as you mark stories interesting and say why. Cues are words or short regular expressions matched in headlines and descriptions.
        </p>
        <div className="space-y-2">
          {signals.map((s) => (
            <div key={s.id} className={`card px-4 py-3 ${s.enabled ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center gap-3">
                <input type="checkbox" checked={!!s.enabled} onChange={(e) => patchSignal(s.id, { enabled: e.target.checked })} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink">{s.label} {!s.builtin && <span className="text-[11px] text-muted">(yours)</span>}</div>
                  <div className="text-[12.5px] text-muted">{s.description}</div>
                </div>
                <label className="flex items-center gap-2 text-[12px] text-muted">
                  Weight
                  <input type="range" min={0} max={3} step={0.25} defaultValue={s.weight} onMouseUp={(e) => patchSignal(s.id, { weight: Number((e.target as HTMLInputElement).value) })} onKeyUp={(e) => patchSignal(s.id, { weight: Number((e.target as HTMLInputElement).value) })} className="w-28" />
                  <span className="w-8 tabular-nums text-ink-2">{s.weight.toFixed(2)}</span>
                </label>
                <span className={`w-24 text-right text-[12px] tabular-nums ${s.learned > 0 ? "text-ok" : s.learned < 0 ? "text-bad" : "text-muted"}`} title="Adjustment learned from your feedback">
                  learned {s.learned >= 0 ? "+" : ""}{s.learned.toFixed(2)}
                </span>
                <div className="flex">
                  {s.learned !== 0 && <button className="btn-ghost !text-[12px]" onClick={() => patchSignal(s.id, { resetLearned: true })}>Reset</button>}
                  <button className="btn-ghost !text-[12px]" onClick={() => { setEditingCues(editingCues === s.id ? null : s.id); setCueText(s.cues.join("\n")); }}>Cues</button>
                  {!s.builtin && <button className="btn-ghost !px-1" onClick={async () => { await api(`/api/signals/${s.id}`, "DELETE"); router.refresh(); }}><Icon name="trash" size={13} /></button>}
                </div>
              </div>
              {editingCues === s.id && (
                <div className="mt-2">
                  <textarea className="input min-h-[120px] font-mono text-[12px]" value={cueText} onChange={(e) => setCueText(e.target.value)} />
                  <div className="mt-1 flex justify-end gap-1">
                    <button className="btn-ghost" onClick={() => setEditingCues(null)}>Cancel</button>
                    <button className="btn-primary !py-1" onClick={async () => { await patchSignal(s.id, { cues: cueText.split("\n") }); setEditingCues(null); }}>Save cues</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="card mt-3 p-4">
          <div className="eyebrow mb-2">Add your own signal</div>
          <div className="grid gap-2 md:grid-cols-2">
            <input className="input" placeholder="Name, e.g. “Climate finance flows”" value={newSig.label} onChange={(e) => setNewSig({ ...newSig, label: e.target.value })} />
            <input className="input" placeholder="What it means to you" value={newSig.description} onChange={(e) => setNewSig({ ...newSig, description: e.target.value })} />
          </div>
          <textarea className="input mt-2 min-h-[70px] text-[13px]" placeholder="Cue words or phrases, one per line (e.g. loss and damage, green bond, adaptation fund)" value={newSig.cues} onChange={(e) => setNewSig({ ...newSig, cues: e.target.value })} />
          <div className="mt-2 flex justify-end">
            <button className="btn-primary" disabled={!newSig.label || !newSig.cues.trim()} onClick={async () => { await api("/api/signals", "POST", { ...newSig, cues: newSig.cues.split("\n") }); setNewSig({ label: "", description: "", cues: "" }); router.refresh(); }}>Add signal</button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-serif text-[19px] font-semibold">Discovery rules</h2>
        <p className="mb-3 text-[13px] text-muted">Explicit rules for things you always or never want. Patterns are plain words or regular expressions.</p>
        <div className="card mb-3 flex flex-wrap items-center gap-2 p-3">
          <select className="input !w-auto" value={rule.action} onChange={(e) => setRule({ ...rule, action: e.target.value })}>
            <option value="boost">Boost</option>
            <option value="bury">Bury</option>
            <option value="hide">Hide</option>
          </select>
          <span className="text-[13px] text-muted">stories where</span>
          <select className="input !w-auto" value={rule.field} onChange={(e) => setRule({ ...rule, field: e.target.value })}>
            <option value="any">any text</option>
            <option value="title">the headline</option>
            <option value="publisher">the outlet</option>
            <option value="region">the region</option>
          </select>
          <span className="text-[13px] text-muted">matches</span>
          <input className="input !w-56" placeholder="e.g. Rohingya|Teesta" value={rule.pattern} onChange={(e) => setRule({ ...rule, pattern: e.target.value })} />
          {rule.action !== "hide" && <input type="number" className="input !w-20" min={0.5} max={10} step={0.5} value={rule.weight} onChange={(e) => setRule({ ...rule, weight: Number(e.target.value) })} />}
          <button className="btn-primary" disabled={!rule.pattern.trim()} onClick={async () => { await api("/api/rules", "POST", rule); setRule({ ...rule, pattern: "" }); router.refresh(); }}>Add rule</button>
        </div>
        <ul className="space-y-1">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center gap-3 text-[13px]">
              <input type="checkbox" checked={!!r.enabled} onChange={async (e) => { await api(`/api/rules/${r.id}`, "PATCH", { enabled: e.target.checked }); router.refresh(); }} />
              <span className="flex-1 text-ink-2"><b className="font-medium capitalize text-ink">{r.action}</b> when {r.field === "any" ? "text" : r.field} matches <code className="rounded bg-surface-2 px-1">{r.pattern}</code>{r.action !== "hide" ? ` (±${r.weight})` : ""}</span>
              <button className="btn-ghost !px-1" onClick={async () => { await api(`/api/rules/${r.id}`, "DELETE"); router.refresh(); }}><Icon name="trash" size={13} /></button>
            </li>
          ))}
          {rules.length === 0 && <li className="text-[13px] text-muted">No rules yet.</li>}
        </ul>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="font-serif text-[19px] font-semibold">Regions</h2>
          <p className="mb-2 text-[13px] text-muted">Extra ranking weight for coverage from these regions (−3 to +3).</p>
          <div className="space-y-1.5">
            {regions.map((r) => (
              <label key={r} className="flex items-center justify-between gap-2 text-[13px]">
                <span>{r}</span>
                <input type="number" className="input !w-20 !py-0.5" step={0.5} min={-3} max={3} value={rw[r] ?? 0} onChange={(e) => setRw({ ...rw, [r]: Number(e.target.value) })} />
              </label>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button className="btn" onClick={async () => { await api("/api/settings", "PATCH", { "discover.region_weights": rw }); router.refresh(); }}>Save region weights</button>
          </div>
          <label className="mt-4 flex items-center gap-2 text-[13px]">
            Default discovery window
            <select className="input !w-auto !py-0.5" defaultValue={windowHours} onChange={async (e) => { await api("/api/settings", "PATCH", { "discover.window_hours": Number(e.target.value) }); router.refresh(); }}>
              {[24, 48, 72, 96, 168, 336].map((h) => <option key={h} value={h}>{h < 168 ? `${h} hours` : `${h / 24} days`}</option>)}
            </select>
          </label>
        </div>
        <div>
          <h2 className="font-serif text-[19px] font-semibold">Learned vocabulary</h2>
          <p className="mb-2 text-[13px] text-muted">Words whose weight changed from your feedback. They nudge ranking by at most ±4 points per story.</p>
          <div className="flex flex-wrap gap-1">
            {topTerms.map((t) => (
              <span key={t.term} className={`chip ${t.weight > 0 ? "border-ok/30 text-ok" : "border-bad/30 text-bad"}`}>{t.term} {t.weight > 0 ? "+" : ""}{t.weight.toFixed(2)}</span>
            ))}
            {topTerms.length === 0 && <span className="text-[13px] text-muted">Nothing learned yet — mark some stories as interesting or not.</span>}
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI & usage
// ---------------------------------------------------------------------------

interface Usage {
  byDay: { day: string; requests: number; cached: number; input_tokens: number; output_tokens: number; cost: number }[];
  byTask: { task: string; requests: number; cached: number; input_tokens: number; output_tokens: number; cost: number }[];
  recent: { id: string; task: string; model: string; status: string; input_tokens: number; output_tokens: number; cost_usd: number; duration_ms: number | null; error: string | null; created_at: string }[];
  cacheEntries: number;
}

export function AiSettings({ settings, status, models, usage }: { settings: AppSettings; status: AiStatus; models: { id: string; label: string; input: number; output: number }[]; usage: Usage }) {
  const router = useRouter();
  const [s, setS] = useState(settings);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const save = async (patch: Partial<AppSettings>) => {
    setErr(null);
    try {
      await api("/api/settings", "PATCH", patch);
      setMsg("Saved");
      setTimeout(() => setMsg(null), 1500);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const anthropic = s["ai.provider"] === "anthropic";

  return (
    <div className="space-y-8">
      <section className={`rounded-lg border px-4 py-3 text-[13px] ${status.available ? "border-ok/30 bg-ok-soft text-ok" : "border-line bg-surface-2 text-ink-2"}`}>
        {status.available ? (
          <>AI is available via <b>{status.provider}</b> using <b>{status.model}</b>. Every paid call is started by you and shows its cost first when it matters.</>
        ) : (
          <>
            <b>AI is unavailable:</b> {status.unavailableReason} Everything else — reading, ranking, searching, organising, source exploration — works without it.
            {!status.configured && status.provider === "anthropic" && (
              <div className="mt-1 text-muted">Add <code className="rounded bg-surface px-1">ANTHROPIC_API_KEY=…</code> to <code className="rounded bg-surface px-1">.env.local</code> in the project folder and restart the server. Keys are read on the server only and never sent to the browser or stored in the database.</div>
            )}
          </>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-serif text-[19px] font-semibold">Provider & model</h2>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={s["ai.enabled"]} onChange={(e) => { setS({ ...s, "ai.enabled": e.target.checked }); void save({ "ai.enabled": e.target.checked }); }} />
            Allow AI features
          </label>
          <div>
            <label className="label">Provider</label>
            <select className="input" value={s["ai.provider"]} onChange={(e) => { const v = e.target.value as AppSettings["ai.provider"]; setS({ ...s, "ai.provider": v }); void save({ "ai.provider": v }); }}>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai_compatible">OpenAI-compatible endpoint (Ollama, LM Studio, OpenRouter…)</option>
            </select>
          </div>
          {anthropic ? (
            <>
              <div>
                <label className="label">Model for research tasks</label>
                <select className="input" value={s["ai.model"]} onChange={(e) => { setS({ ...s, "ai.model": e.target.value }); void save({ "ai.model": e.target.value }); }}>
                  {models.map((m) => <option key={m.id} value={m.id}>{m.label} — ${m.input}/${m.output} per M tokens</option>)}
                </select>
              </div>
              <div>
                <label className="label">Model for bulk story assessment (optional, cheaper)</label>
                <select className="input" value={s["ai.bulk_model"]} onChange={(e) => { setS({ ...s, "ai.bulk_model": e.target.value }); void save({ "ai.bulk_model": e.target.value }); }}>
                  <option value="">Same as above</option>
                  {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Reasoning effort</label>
                <select className="input" value={s["ai.effort"]} onChange={(e) => { const v = e.target.value as AppSettings["ai.effort"]; setS({ ...s, "ai.effort": v }); void save({ "ai.effort": v }); }}>
                  <option value="low">Low — fastest, cheapest</option>
                  <option value="medium">Medium — default</option>
                  <option value="high">High — more thorough, costs more</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="label">Base URL (leave empty to use OPENAI_COMPAT_BASE_URL)</label>
                <input className="input" value={s["ai.openai_base_url"]} onChange={(e) => setS({ ...s, "ai.openai_base_url": e.target.value })} onBlur={() => save({ "ai.openai_base_url": s["ai.openai_base_url"] })} placeholder="http://localhost:11434/v1" />
              </div>
              <div>
                <label className="label">Model name</label>
                <input className="input" value={s["ai.model"]} onChange={(e) => setS({ ...s, "ai.model": e.target.value })} onBlur={() => save({ "ai.model": s["ai.model"] })} placeholder="e.g. llama3.1:8b" />
              </div>
              <p className="text-[12px] text-muted">Costs for models not in the built-in price list are recorded as $0. Set the API key (if any) as OPENAI_COMPAT_API_KEY on the server.</p>
            </>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="font-serif text-[19px] font-semibold">Budgets</h2>
          <p className="text-[12.5px] text-muted">Checked before every call against a worst-case estimate. Calls that would exceed a limit are refused and logged.</p>
          {([
            ["budget.daily_usd", "Daily limit (USD)"],
            ["budget.monthly_usd", "Monthly limit (USD)"],
            ["budget.per_task_usd", "Per-task limit (USD)"],
          ] as const).map(([k, label]) => (
            <div key={k}>
              <label className="label">{label}</label>
              <input type="number" min={0} step={0.05} className="input" value={s[k]} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) })} onBlur={() => save({ [k]: s[k] })} />
            </div>
          ))}
          <div className="rounded-md bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">
            Spent today: <b>{usd(status.spentToday)}</b> of {usd(status.dailyLimit)} · this month: <b>{usd(status.spentMonth)}</b> of {usd(status.monthlyLimit)}
          </div>
          {msg && <p className="text-[12px] text-ok">{msg}</p>}
          {err && <p className="text-[12px] text-bad">{err}</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-serif text-[19px] font-semibold">Usage (last 30 days)</h2>
        <p className="mb-3 text-[12.5px] text-muted">Estimated from token counts and list prices; your provider&apos;s invoice is authoritative. {usage.cacheEntries} cached AI results are reused instead of regenerated.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <table className="w-full text-[12.5px]">
            <thead><tr className="text-left text-muted"><th className="py-1">Task</th><th className="text-right">Calls</th><th className="text-right">Cached</th><th className="text-right">Tokens in/out</th><th className="text-right">Est. cost</th></tr></thead>
            <tbody>
              {usage.byTask.map((t) => (
                <tr key={t.task} className="border-t border-line"><td className="py-1">{t.task}</td><td className="text-right tabular-nums">{t.requests}</td><td className="text-right tabular-nums">{t.cached}</td><td className="text-right tabular-nums">{t.input_tokens.toLocaleString()} / {t.output_tokens.toLocaleString()}</td><td className="text-right tabular-nums">{usd(t.cost)}</td></tr>
              ))}
              {usage.byTask.length === 0 && <tr><td colSpan={5} className="py-2 text-muted">No AI calls yet.</td></tr>}
            </tbody>
          </table>
          <table className="w-full text-[12.5px]">
            <thead><tr className="text-left text-muted"><th className="py-1">Day</th><th className="text-right">Calls</th><th className="text-right">Cached</th><th className="text-right">Est. cost</th></tr></thead>
            <tbody>
              {usage.byDay.map((d) => (
                <tr key={d.day} className="border-t border-line"><td className="py-1">{d.day}</td><td className="text-right tabular-nums">{d.requests}</td><td className="text-right tabular-nums">{d.cached}</td><td className="text-right tabular-nums">{usd(d.cost)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {usage.recent.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-[13px] text-muted hover:text-ink">Request log</summary>
            <table className="mt-2 w-full text-[12px]">
              <tbody>
                {usage.recent.map((r) => (
                  <tr key={r.id} className="border-t border-line align-top">
                    <td className="whitespace-nowrap py-1 pr-2 text-muted">{fmtDate(r.created_at, true)}</td>
                    <td className="pr-2">{r.task}</td>
                    <td className="pr-2 text-muted">{r.model}</td>
                    <td className={`pr-2 ${r.status === "ok" ? "text-ok" : r.status === "cached" ? "text-muted" : "text-bad"}`}>{r.status}</td>
                    <td className="pr-2 text-right tabular-nums">{r.input_tokens}/{r.output_tokens}</td>
                    <td className="pr-2 text-right tabular-nums">{usd(r.cost_usd)}</td>
                    <td className="max-w-[260px] truncate text-muted" title={r.error ?? ""}>{r.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export function PipelineSettings({ stages, dbPath }: { stages: PipelineStage[]; dbPath: string }) {
  const router = useRouter();
  const [list, setList] = useState(stages);
  const [msg, setMsg] = useState<string | null>(null);
  const move = (i: number, d: number) => {
    const next = [...list];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    setList(next);
  };
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section>
        <h2 className="font-serif text-[19px] font-semibold">Editorial pipeline</h2>
        <p className="mb-3 text-[13px] text-muted">Stages a research project moves through. Rename, reorder, add or remove to match your process.</p>
        <ul className="space-y-1.5">
          {list.map((s, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <input className="input" value={s.label} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <button className="btn-ghost !px-1" disabled={i === 0} onClick={() => move(i, -1)}><Icon name="up" size={14} /></button>
              <button className="btn-ghost !px-1" disabled={i === list.length - 1} onClick={() => move(i, 1)}><Icon name="down" size={14} /></button>
              <button className="btn-ghost !px-1" disabled={list.length <= 2} onClick={() => setList(list.filter((_, j) => j !== i))}><Icon name="trash" size={13} /></button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <button className="btn" onClick={() => setList([...list, { id: `stage_${Date.now().toString(36)}`, label: "New stage" }])}><Icon name="plus" size={13} /> Add stage</button>
          <button className="btn-primary" onClick={async () => { await api("/api/settings", "PATCH", { "pipeline.stages": list.filter((s) => s.label.trim()) }); setMsg("Saved"); router.refresh(); }}>Save pipeline</button>
          {msg && <span className="self-center text-[12px] text-ok">{msg}</span>}
        </div>
      </section>
      <section>
        <h2 className="font-serif text-[19px] font-semibold">Data</h2>
        <p className="text-[13px] text-ink-2">All data lives in one SQLite file on this machine:</p>
        <code className="mt-1 block break-all rounded bg-surface-2 px-2 py-1 text-[12px]">{dbPath}</code>
        <p className="mt-2 text-[12.5px] text-muted">Back it up by copying the file while the server is stopped. Set DATABASE_PATH to move it.</p>
      </section>
    </div>
  );
}
