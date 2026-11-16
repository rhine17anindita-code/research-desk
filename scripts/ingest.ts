/** Fetch all enabled feeds once: `npm run ingest` */
import { getDb } from "../src/lib/db";
import { ingestFeeds } from "../src/lib/ingest/pipeline";

const db = getDb();
ingestFeeds(db, { trigger: "cli" }).then((r) => {
  console.log(`Feeds ok: ${r.feedsOk}, failed: ${r.feedsFailed}`);
  console.log(`New articles: ${r.articlesNew}, duplicates skipped: ${r.articlesDuplicate}, new stories: ${r.clustersNew}`);
  for (const f of r.failures) console.log(`  ✗ ${f.feed}: ${f.error}`);
});
