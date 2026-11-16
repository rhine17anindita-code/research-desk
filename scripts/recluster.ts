/** Regroup recent untouched stories with the current clustering rules: `npm run recluster [days]` */
import { getDb } from "../src/lib/db";
import { reclusterRecent } from "../src/lib/ingest/pipeline";

const db = getDb();
const stat = () => db.prepare("SELECT COUNT(*) AS n, SUM(source_count >= 2) AS multi, SUM(source_count >= 3) AS three FROM clusters WHERE last_updated_at >= datetime('now', '-4 days')").get() as { n: number; multi: number; three: number };
const before = stat();
const r = reclusterRecent(db, Number(process.argv[2] ?? 4));
const after = stat();
console.log(`Stories: ${before.n} -> ${after.n} (kept ${r.kept} with your work)`);
console.log(`Covered by 2+ outlets: ${before.multi} -> ${after.multi}; 3+ outlets: ${before.three} -> ${after.three}`);
