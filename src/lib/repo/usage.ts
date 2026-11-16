import type { DB } from "../db";

export function usageSummary(db: DB) {
  const byDay = db
    .prepare(
      `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS requests, SUM(CASE WHEN status = 'cached' THEN 1 ELSE 0 END) AS cached,
              SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens, SUM(cost_usd) AS cost
       FROM ai_requests WHERE created_at >= date('now', '-30 days') GROUP BY day ORDER BY day DESC`,
    )
    .all() as { day: string; requests: number; cached: number; input_tokens: number; output_tokens: number; cost: number }[];
  const byTask = db
    .prepare(
      `SELECT task, COUNT(*) AS requests, SUM(CASE WHEN status = 'cached' THEN 1 ELSE 0 END) AS cached, SUM(input_tokens) AS input_tokens,
              SUM(output_tokens) AS output_tokens, SUM(cost_usd) AS cost FROM ai_requests WHERE created_at >= date('now', '-30 days') GROUP BY task ORDER BY cost DESC`,
    )
    .all() as { task: string; requests: number; cached: number; input_tokens: number; output_tokens: number; cost: number }[];
  const recent = db.prepare("SELECT * FROM ai_requests ORDER BY created_at DESC LIMIT 40").all() as {
    id: string; task: string; provider: string; model: string; status: string; input_tokens: number; output_tokens: number; cost_usd: number; duration_ms: number | null; error: string | null; created_at: string;
  }[];
  const cacheEntries = (db.prepare("SELECT COUNT(*) AS n FROM ai_cache").get() as { n: number }).n;
  return { byDay, byTask, recent, cacheEntries };
}
