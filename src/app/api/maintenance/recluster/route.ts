import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { reclusterRecent } from "@/lib/ingest/pipeline";

export const POST = route(() => ({ ok: true, ...reclusterRecent(getDb(), 4) }));
