import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { updateTasteSummary } from "@/lib/ideation/ai";

export const POST = route(async (req: Request) => updateTasteSummary(getDb(), await body(req)));
