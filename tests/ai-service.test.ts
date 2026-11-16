import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { getAiStatus, runAiTask } from "@/lib/ai/service";
import { setSetting } from "@/lib/repo/settings";
import { freshDb, MockProvider, useMock } from "./helpers";
import type { DB } from "@/lib/db";

const schema = z.object({ answer: z.string() });
const task = (extra = {}) => ({ task: "test.echo", system: "sys", user: "hello", schema, maxTokens: 500, ...extra });

describe("AI gateway", () => {
  let db: DB;
  beforeEach(() => {
    db = freshDb();
  });
  afterEach(() => useMock(null));

  it("degrades gracefully when no provider is configured", async () => {
    useMock(new MockProvider({}, false));
    const r = await runAiTask(db, task());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_configured");
    expect(getAiStatus(db).available).toBe(false);
  });

  it("respects the AI on/off switch", async () => {
    useMock(new MockProvider({ answer: () => ({ answer: "x" }) }));
    setSetting(db, "ai.enabled", false);
    const r = await runAiTask(db, task());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("disabled");
  });

  it("caches results and reuses them without a second provider call", async () => {
    const p = new MockProvider({ answer: () => ({ answer: "42" }) });
    useMock(p);
    const a = await runAiTask(db, task());
    const b = await runAiTask(db, task());
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.cached).toBe(false);
      expect(b.cached).toBe(true);
      expect(b.costUsd).toBe(0);
      expect(b.data.answer).toBe("42");
    }
    expect(p.calls).toHaveLength(1);
    const logged = db.prepare("SELECT status, cost_usd FROM ai_requests ORDER BY created_at").all() as { status: string; cost_usd: number }[];
    expect(logged.map((l) => l.status)).toEqual(["ok", "cached"]);
    expect(logged[0].cost_usd).toBeGreaterThan(0);
  });

  it("bypasses the cache only when explicitly asked", async () => {
    const p = new MockProvider({ answer: () => ({ answer: "x" }) });
    useMock(p);
    await runAiTask(db, task());
    await runAiTask(db, task({ bypassCache: true }));
    expect(p.calls).toHaveLength(2);
  });

  it("blocks calls that would exceed a budget and logs them", async () => {
    const p = new MockProvider({ answer: () => ({ answer: "x" }) });
    useMock(p);
    setSetting(db, "budget.per_task_usd", 0.0001);
    const r = await runAiTask(db, task());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("budget");
    expect(p.calls).toHaveLength(0);
    setSetting(db, "budget.per_task_usd", 1);
    db.prepare("INSERT INTO ai_requests (id, task, provider, model, status, cost_usd, created_at) VALUES ('x', 't', 'm', 'm', 'ok', 5, ?)").run(new Date().toISOString());
    const r2 = await runAiTask(db, task({ user: "different" }));
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.message).toMatch(/Daily AI budget/);
  });

  it("discards output that does not match the schema", async () => {
    useMock(new MockProvider({ answer: () => ({ answer: 7 }) }));
    const r = await runAiTask(db, task());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_output");
    expect((db.prepare("SELECT COUNT(*) AS n FROM ai_cache").get() as { n: number }).n).toBe(0);
  });
});
