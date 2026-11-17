import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { analyseVoice } from "@/lib/voice";

export const maxDuration = 180;
export const POST = route(async (req: Request) => analyseVoice(getDb(), await body<{ estimateOnly?: boolean }>(req)));
