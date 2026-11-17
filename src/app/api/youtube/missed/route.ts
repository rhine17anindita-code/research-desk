import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { missedAngles } from "@/lib/youtube";

/** Big stories none of your competitors covered in the last 30 days. */
export const GET = route(async (req: Request) => ({ ok: true, missed: await missedAngles(getDb(), new URL(req.url).searchParams.get("yt") ?? "") }));
