import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { metaStatus, syncMeta } from "@/lib/performance/meta";

export const maxDuration = 180;

/** Is the Meta connection working, which Page/Instagram it sees, and when the token expires. Never returns the token. */
export const GET = route(async () => ({ ok: true, status: await metaStatus(getDb()) }));

/** Pull Instagram and Facebook numbers now. Read-only. */
export const POST = route(async () => ({ ok: true, result: await syncMeta(getDb()) }));
