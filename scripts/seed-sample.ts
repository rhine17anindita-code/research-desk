/** Load clearly-labelled fictional sample stories (offline fallback): `npm run seed:sample` */
import { getDb } from "../src/lib/db";
import { loadSampleData } from "../src/lib/ingest/sample";

const r = loadSampleData(getDb());
console.log(`Loaded ${r.articles} sample articles into ${r.stories} sample stories. Remove them in Settings → Sources.`);
