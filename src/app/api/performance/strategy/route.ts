import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { strategyReport } from "@/lib/performance/ai";

export const maxDuration = 180;
export const POST = route(async (req: Request) => strategyReport(getDb(), await body<{ estimateOnly?: boolean; direction?: string }>(req)));
