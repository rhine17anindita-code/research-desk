import { getDb } from "@/lib/db";
import { body, json, route } from "@/lib/http";
import { verifyHelper } from "@/lib/helper-auth";
import { saveHelperPage, saveText } from "@/lib/ingest/fulltext";

export const maxDuration = 60;

/** The Mac helper hands over a news page this server was refused. */
export const POST = route(async (req: Request) => {
  if (!verifyHelper(req)) return json({ ok: false, message: "Not signed by the helper" }, 401);
  const b = await body<{ id: string; html?: string; status?: "failed" | "summary" }>(req);
  const db = getDb();
  if (b.html) saveHelperPage(db, b.id, b.html.slice(0, 3_000_000));
  else saveText(db, b.id, b.status === "summary" ? "summary" : "failed");
  return { ok: true };
});
