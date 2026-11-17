import type { DB } from "../db";
import type { Source } from "../types";
import { articleText } from "../research-inbox";
import { getText, isPublicHttpUrl } from "../ideation/metadata";
import { nowIso } from "../ids";
import { truncate } from "../text";

/**
 * Replace feed blurbs with the full article text, so research and scripts work from the real
 * reporting (free; paywalled or blocked pages keep their summary). Each page is fetched once.
 */
export async function deepenSourceList(db: DB, sources: Source[], limit = 16): Promise<{ checked: number; deepened: number }> {
  const todo = [...new Map(sources.filter((s) => s.url && isPublicHttpUrl(s.url) && (s.excerpt?.length ?? 0) < 2500 && !/youtube\.com|youtu\.be|instagram\.com|tiktok\.com|facebook\.com/.test(s.url)).map((s) => [s.id, s])).values()].slice(0, limit);
  let deepened = 0;
  let i = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (i < todo.length) {
        const s = todo[i++];
        try {
          const text = articleText(await getText(s.url!, "text/html", 3_000_000));
          if (text.length > Math.max(800, (s.excerpt?.length ?? 0) + 300)) {
            db.prepare("UPDATE sources SET excerpt = ?, updated_at = ? WHERE id = ?").run(truncate(text, 15000), nowIso(), s.id);
            deepened++;
          }
        } catch {
          /* paywalled or blocked: keep the summary */
        }
      }
    }),
  );
  return { checked: todo.length, deepened };
}
