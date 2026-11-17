import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { importOwnVideos } from "@/lib/voice";

export const maxDuration = 120;

/** Add your best videos from every connected platform to transcribe (free). */
export const POST = route(async () => ({ ok: true, added: await importOwnVideos(getDb()) }));
