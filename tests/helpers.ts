import fs from "node:fs";
import path from "node:path";
import { openDb, setDbForTesting, type DB } from "@/lib/db";
import { setProviderForTesting } from "@/lib/ai/service";
import type { AiProvider, CompletionRequest, CompletionResult } from "@/lib/ai/types";

export function fixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
}

export function freshDb(): DB {
  const db = openDb(":memory:");
  // Tests should not depend on the default feed list.
  db.prepare("DELETE FROM feeds").run();
  setDbForTesting(db);
  return db;
}

export const FIXTURE_FEEDS: Record<string, string> = {
  "https://alpha.example.com/rss": "feed-a.xml",
  "https://beta.example.org/atom": "feed-b.xml",
};

export function addFixtureFeeds(db: DB) {
  const now = new Date().toISOString();
  db.prepare("INSERT INTO feeds (id, name, url, region, enabled, priority, created_at, updated_at) VALUES ('feed_a', 'Alpha News', 'https://alpha.example.com/rss', 'Sample', 1, 1, ?, ?)").run(now, now);
  db.prepare("INSERT INTO feeds (id, name, url, region, enabled, priority, created_at, updated_at) VALUES ('feed_b', 'Beta Wire', 'https://beta.example.org/atom', 'Sample', 1, 1, ?, ?)").run(now, now);
  db.prepare("INSERT INTO feeds (id, name, url, region, enabled, priority, created_at, updated_at) VALUES ('feed_c', 'Broken Feed', 'https://broken.example.net/rss', 'Sample', 1, 1, ?, ?)").run(now, now);
}

export async function fixtureFetcher(url: string): Promise<string> {
  const f = FIXTURE_FEEDS[url];
  if (!f) throw new Error("HTTP 404");
  return fixture(f);
}

/** Scripted provider: picks a reply by the shape of the requested JSON schema. */
export class MockProvider implements AiProvider {
  id = "mock";
  calls: CompletionRequest[] = [];
  constructor(private replies: Record<string, (req: CompletionRequest) => unknown>, private configured = true) {}
  isConfigured() {
    return this.configured;
  }
  async complete(req: CompletionRequest): Promise<CompletionResult> {
    this.calls.push(req);
    const props = Object.keys((req.jsonSchema.properties as Record<string, unknown>) ?? {});
    const key = Object.keys(this.replies).find((k) => props.includes(k));
    if (!key) throw new Error(`No mock reply for schema with ${props.join(",")}`);
    return { text: JSON.stringify(this.replies[key](req)), inputTokens: 1000, outputTokens: 200, model: req.model };
  }
}

export function useMock(p: MockProvider | null) {
  setProviderForTesting(p);
}
