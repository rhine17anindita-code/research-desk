import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { mineComments } from "@/lib/performance/ai";

export const maxDuration = 180;
export const POST = route(async (req: Request) => mineComments(getDb(), await body<{ estimateOnly?: boolean }>(req)));
