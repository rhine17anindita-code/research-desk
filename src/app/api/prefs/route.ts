import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { getPrefs, updatePrefs } from "@/lib/prefs";
import type { Prefs } from "@/lib/prefs-shared";

export const GET = route(() => ({ ok: true, prefs: getPrefs(getDb()) }));
export const PATCH = route(async (req: Request) => ({ ok: true, prefs: updatePrefs(getDb(), await body<Partial<Prefs>>(req)) }));
