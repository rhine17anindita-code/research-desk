import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { ideaFeed } from "@/lib/youtube/producer";

export const maxDuration = 60;

/** Ideas ready to produce for a YouTube channel, with the evidence for each (free). */
export const GET = route(async (req: Request) => ({ ok: true, ideas: await ideaFeed(getDb(), new URL(req.url).searchParams.get("yt") ?? "") }));
