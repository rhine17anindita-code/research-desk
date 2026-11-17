import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { importCsv } from "@/lib/performance/csv-import";

/** Import a stats export (CSV) from Meta Business Suite or TikTok Studio. Free. */
export const POST = route(async (req: Request) => {
  const fd = await req.formData();
  const f = fd.get("file");
  if (!(f instanceof File) || !f.size) throw new Error("Choose the exported CSV file");
  if (/\.xlsx?$/i.test(f.name)) throw new Error("That's an Excel file — export as CSV instead (or open it and Save As → CSV).");
  if (f.size > 20 * 1024 * 1024) throw new Error("That file is over 20 MB — export a shorter date range");
  return { ok: true, result: importCsv(getDb(), await f.text(), (fd.get("platform") as string) || undefined) };
});
