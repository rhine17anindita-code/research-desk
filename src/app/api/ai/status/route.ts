import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { getAiStatus } from "@/lib/ai/service";

export const GET = route(() => ({ ok: true, status: getAiStatus(getDb()) }));
