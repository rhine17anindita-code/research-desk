import { getDb } from "@/lib/db";
import { loadSampleData, removeSampleData } from "@/lib/ingest/sample";
import { route } from "@/lib/http";

export const POST = route(() => ({ ok: true, ...loadSampleData(getDb()) }));
export const DELETE = route(() => ({ ok: true, removed: removeSampleData(getDb()) }));
