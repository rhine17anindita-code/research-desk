import { z } from "zod";
import type { DB } from "../db";
import { newId, nowIso } from "../ids";
import { sha256 } from "../text";
import { getAllSettings } from "../repo/settings";
import { approxTokens, estimateCost } from "./pricing";
import { AnthropicProvider, OpenAiCompatibleProvider } from "./providers";
import type { AiProvider, AiResult, AiTask } from "./types";
import { modelForTask } from "./task-models";

/**
 * The single gateway for every model call in the app. It enforces, in order:
 *   1. AI enabled + provider configured (otherwise a clear, non-throwing failure)
 *   2. cache reuse (identical task + inputs + model ⇒ stored result, zero cost)
 *   3. per-task, daily and monthly budget limits using a worst-case estimate
 *   4. structured output validation (zod) — invalid output is never stored
 *   5. usage logging (tokens, estimated cost, duration, status)
 */

let providerOverride: AiProvider | null = null;
export function setProviderForTesting(p: AiProvider | null): void {
  providerOverride = p;
}

export function getProvider(db: DB): AiProvider {
  if (providerOverride) return providerOverride;
  const s = getAllSettings(db);
  return s["ai.provider"] === "openai_compatible" ? new OpenAiCompatibleProvider(s["ai.openai_base_url"] || undefined) : new AnthropicProvider();
}

export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

function spendSince(db: DB, sinceIso: string): number {
  const r = db.prepare("SELECT COALESCE(SUM(cost_usd), 0) AS s FROM ai_requests WHERE created_at >= ?").get(sinceIso) as { s: number };
  return r.s;
}

function startOfDay(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export interface AiStatus {
  enabled: boolean;
  provider: string;
  configured: boolean;
  model: string;
  bulkModel: string;
  spentToday: number;
  spentMonth: number;
  dailyLimit: number;
  monthlyLimit: number;
  perTaskLimit: number;
  available: boolean;
  unavailableReason: string | null;
}

export function getAiStatus(db: DB): AiStatus {
  const s = getAllSettings(db);
  const provider = getProvider(db);
  const spentToday = spendSince(db, startOfDay());
  const spentMonth = spendSince(db, startOfMonth());
  const configured = provider.isConfigured();
  let reason: string | null = null;
  if (!s["ai.enabled"]) reason = "AI features are turned off in Settings.";
  else if (!configured)
    reason = provider.id === "anthropic" ? "No ANTHROPIC_API_KEY is configured on the server." : "No OpenAI-compatible base URL is configured.";
  else if (spentToday >= s["budget.daily_usd"]) reason = "Today's AI budget is used up.";
  else if (spentMonth >= s["budget.monthly_usd"]) reason = "This month's AI budget is used up.";
  return {
    enabled: s["ai.enabled"],
    provider: provider.id,
    configured,
    model: s["ai.model"],
    bulkModel: s["ai.bulk_model"] || s["ai.model"],
    spentToday,
    spentMonth,
    dailyLimit: s["budget.daily_usd"],
    monthlyLimit: s["budget.monthly_usd"],
    perTaskLimit: s["budget.per_task_usd"],
    available: reason === null,
    unavailableReason: reason,
  };
}

/** The model a task will use, honouring per-task choices (Anthropic) and the bulk model. */
export function chooseModel(db: DB, task: { task?: string; bulk?: boolean }): string {
  const s = getAllSettings(db);
  const base = task.bulk && s["ai.bulk_model"] ? s["ai.bulk_model"] : s["ai.model"];
  if (s["ai.provider"] !== "anthropic") return base;
  return modelForTask(task.task, s["ai.task_models"] ?? {}, base);
}

/** Worst-case cost estimate for a task before it runs (full max_tokens output). */
export function estimateTaskCost(db: DB, task: Pick<AiTask<unknown>, "system" | "user" | "maxTokens" | "bulk" | "fileTokens"> & { task?: string }): { model: string; inputTokens: number; usd: number } {
  const model = chooseModel(db, task);
  const inputTokens = approxTokens(task.system + task.user) + 400 + (task.fileTokens ?? 0);
  return { model, inputTokens, usd: estimateCost(model, inputTokens, task.maxTokens) };
}

function logRequest(
  db: DB,
  r: { task: string; provider: string; model: string; status: string; inputTokens?: number; outputTokens?: number; cost?: number; durationMs?: number; error?: string; cacheKey?: string },
): string {
  const id = newId("ai");
  db.prepare(
    `INSERT INTO ai_requests (id, task, provider, model, status, input_tokens, output_tokens, cost_usd, duration_ms, error, cache_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, r.task, r.provider, r.model, r.status, r.inputTokens ?? 0, r.outputTokens ?? 0, r.cost ?? 0, r.durationMs ?? null, r.error ?? null, r.cacheKey ?? null, nowIso());
  return id;
}

function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
    throw new Error("Reply was not valid JSON");
  }
}

export async function runAiTask<T>(db: DB, task: AiTask<T>): Promise<AiResult<T>> {
  const s = getAllSettings(db);
  const provider = getProvider(db);
  const model = chooseModel(db, task);

  if (!s["ai.enabled"]) return { ok: false, reason: "disabled", message: "AI features are turned off in Settings → AI." };
  if (!provider.isConfigured())
    return {
      ok: false,
      reason: "not_configured",
      message:
        provider.id === "anthropic"
          ? "No AI provider is configured. Add ANTHROPIC_API_KEY to .env.local and restart the server, or choose another provider in Settings → AI."
          : "Set an OpenAI-compatible base URL in Settings → AI or OPENAI_COMPAT_BASE_URL.",
    };

  const cacheKey = sha256(JSON.stringify([task.task, model, task.cacheParts ?? [task.system, task.user]]));

  if (!task.bypassCache) {
    const hit = db.prepare("SELECT response FROM ai_cache WHERE key = ?").get(cacheKey) as { response: string } | undefined;
    if (hit) {
      const parsed = task.schema.safeParse(JSON.parse(hit.response));
      if (parsed.success) {
        const requestId = logRequest(db, { task: task.task, provider: provider.id, model, status: "cached", cacheKey });
        return { ok: true, data: parsed.data, cached: true, requestId, model, costUsd: 0 };
      }
    }
  }

  // Budgets, checked against a worst-case estimate so a single call cannot overshoot much.
  const est = estimateTaskCost(db, task);
  const spentToday = spendSince(db, startOfDay());
  const spentMonth = spendSince(db, startOfMonth());
  const block = (message: string): AiResult<T> => {
    logRequest(db, { task: task.task, provider: provider.id, model, status: "blocked", error: message });
    return { ok: false, reason: "budget", message };
  };
  if (est.usd > s["budget.per_task_usd"])
    return block(`This task could cost up to $${est.usd.toFixed(3)}, above the per-task limit of $${s["budget.per_task_usd"].toFixed(2)}. Raise the limit in Settings → AI or choose a cheaper model.`);
  if (spentToday + est.usd > s["budget.daily_usd"])
    return block(`Daily AI budget reached ($${spentToday.toFixed(3)} of $${s["budget.daily_usd"].toFixed(2)} used). Adjust it in Settings → AI.`);
  if (spentMonth + est.usd > s["budget.monthly_usd"])
    return block(`Monthly AI budget reached ($${spentMonth.toFixed(2)} of $${s["budget.monthly_usd"].toFixed(2)} used). Adjust it in Settings → AI.`);

  const started = Date.now();
  let completion;
  try {
    completion = await provider.complete({
      system: task.system,
      user: task.user,
      jsonSchema: jsonSchemaOf(task.schema),
      maxTokens: task.maxTokens,
      model,
      effort: s["ai.effort"],
      files: task.files,
    });
  } catch (err) {
    const message = (err as Error).message || "Unknown provider error";
    logRequest(db, { task: task.task, provider: provider.id, model, status: "error", error: message.slice(0, 500), durationMs: Date.now() - started });
    return { ok: false, reason: "provider_error", message: `The AI provider returned an error: ${message}` };
  }

  const cost = estimateCost(model, completion.inputTokens, completion.outputTokens);
  let parsed: z.ZodSafeParseResult<T>;
  try {
    parsed = task.schema.safeParse(extractJson(completion.text));
  } catch (err) {
    parsed = { success: false, error: new z.ZodError([{ code: "custom", message: (err as Error).message, path: [], input: completion.text }]) } as z.ZodSafeParseResult<T>;
  }
  if (!parsed.success) {
    logRequest(db, {
      task: task.task, provider: provider.id, model, status: "error", inputTokens: completion.inputTokens, outputTokens: completion.outputTokens,
      cost, durationMs: Date.now() - started, error: `Invalid structured output: ${parsed.error.message.slice(0, 300)}`,
    });
    return { ok: false, reason: "invalid_output", message: "The model's reply did not match the expected structure, so it was discarded. Try again." };
  }

  db.prepare("INSERT INTO ai_cache (key, task, model, response, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET response = excluded.response, created_at = excluded.created_at")
    .run(cacheKey, task.task, model, JSON.stringify(parsed.data), nowIso());
  const requestId = logRequest(db, {
    task: task.task, provider: provider.id, model: completion.model || model, status: "ok", inputTokens: completion.inputTokens,
    outputTokens: completion.outputTokens, cost, durationMs: Date.now() - started, cacheKey,
  });
  return { ok: true, data: parsed.data, cached: false, requestId, model: completion.model || model, costUsd: cost };
}
