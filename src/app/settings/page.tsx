import Link from "next/link";
import { getDb, parseJson, resolveDbPath } from "@/lib/db";
import { getAllSettings } from "@/lib/repo/settings";
import { getAiStatus } from "@/lib/ai/service";
import { usageSummary } from "@/lib/repo/usage";
import { MODEL_PRICING } from "@/lib/ai/pricing";
import { AiSettings, FeedsSettings, PersonalisationSettings, PipelineSettings } from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const tab = sp.tab ?? "sources";
  const db = getDb();
  const settings = getAllSettings(db);
  const tabs = [
    ["sources", "Sources"],
    ["personalisation", "Personalisation"],
    ["ai", "AI & usage"],
    ["pipeline", "Pipeline"],
  ];

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="mb-4 font-serif text-[28px] font-semibold tracking-tight">Settings</h1>
      <div className="mb-5 flex gap-1 border-b border-line">
        {tabs.map(([id, label]) => (
          <Link key={id} href={`/settings?tab=${id}`} className={`-mb-px border-b-2 px-3 py-2 text-[13.5px] font-medium ${tab === id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {label}
          </Link>
        ))}
      </div>

      {tab === "sources" && (
        <FeedsSettings
          feeds={db.prepare("SELECT f.*, (SELECT COUNT(*) FROM articles a WHERE a.feed_id = f.id) AS articles FROM feeds f ORDER BY f.enabled DESC, f.category, f.name").all() as never}
          hasSample={!!db.prepare("SELECT 1 FROM articles WHERE is_sample = 1 LIMIT 1").get()}
          runs={db.prepare("SELECT * FROM ingest_runs ORDER BY started_at DESC LIMIT 5").all() as never}
          scheduleMinutes={Number(process.env.INGEST_INTERVAL_MINUTES ?? 0)}
        />
      )}
      {tab === "personalisation" && (
        <PersonalisationSettings
          signals={(db.prepare("SELECT * FROM signals ORDER BY builtin DESC, label").all() as { cues: string }[]).map((s) => ({ ...s, cues: parseJson<string[]>(s.cues, []) })) as never}
          rules={db.prepare("SELECT * FROM rules ORDER BY created_at DESC").all() as never}
          regions={(db.prepare("SELECT DISTINCT region FROM feeds WHERE region IS NOT NULL ORDER BY region").all() as { region: string }[]).map((r) => r.region)}
          regionWeights={settings["discover.region_weights"]}
          windowHours={settings["discover.window_hours"]}
          topTerms={db.prepare("SELECT term, weight FROM term_weights ORDER BY ABS(weight) DESC LIMIT 24").all() as never}
        />
      )}
      {tab === "ai" && (
        <AiSettings
          settings={settings}
          status={getAiStatus(db)}
          models={Object.entries(MODEL_PRICING).map(([id, p]) => ({ id, label: p.label, input: p.input, output: p.output }))}
          usage={usageSummary(db)}
        />
      )}
      {tab === "pipeline" && <PipelineSettings stages={settings["pipeline.stages"]} dbPath={resolveDbPath()} />}
    </div>
  );
}
