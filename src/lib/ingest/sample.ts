import type { DB } from "../db";
import { clusterPending, insertArticle } from "./pipeline";

/**
 * Offline fallback ONLY. Fictional stories about invented places, clearly labelled
 * "Sample" everywhere in the UI, with example.org URLs. Load them to try the
 * research workflow when no feeds can be reached; remove them in Settings.
 */
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const SAMPLE: { publisher: string; region: string; title: string; summary: string; h: number }[] = [
  { publisher: "Sample Wire (fictional)", region: "Sample", h: 5, title: "Veloria announces framework to share river water with Ostrand, details not disclosed", summary: "The government of Veloria said it had agreed a framework with neighbouring Ostrand on sharing the Amber River, but did not specify volumes, enforcement or how disputes would be settled." },
  { publisher: "Sample Courier (fictional)", region: "Sample", h: 4, title: "Veloria and Ostrand reach Amber River water-sharing framework", summary: "Officials hailed the first agreement between the two countries since 1998. Farmers' groups said they had not been consulted and questioned whether dry-season flows would be guaranteed." },
  { publisher: "Sample Ledger (fictional)", region: "Sample", h: 3, title: "Amber River deal: Ostrand denies it agreed to new dam limits", summary: "Ostrand's water ministry rejected claims by Velorian officials that the framework restricts construction of new upstream dams, contradicting statements made in Veloria's capital." },
  { publisher: "Sample Wire (fictional)", region: "Sample", h: 12, title: "Port of Calder awards terminal contract to consortium backed by state pension fund", summary: "The concession, valued at an undisclosed sum, was awarded without a public tender. The consortium includes a firm whose chair previously advised the transport ministry." },
  { publisher: "Sample Courier (fictional)", region: "Sample", h: 10, title: "Calder port terminal concession goes to pension-fund consortium without tender", summary: "Opposition lawmakers said the deal raises conflict of interest questions and demanded publication of the contract." },
  { publisher: "Sample Ledger (fictional)", region: "Sample", h: 20, title: "Hospital nurse shortage in Marrowfield reaches record high, report says", summary: "A regional health authority report found vacancies at their highest since records began, blaming training bottlenecks and migration of staff abroad." },
  { publisher: "Sample Wire (fictional)", region: "Sample", h: 30, title: "Central bank of Veloria holds rates, signals concern over food prices", summary: "Policymakers kept the benchmark rate unchanged and said drought-related food price rises could persist into next year." },
  { publisher: "Sample Courier (fictional)", region: "Sample", h: 8, title: "Tech firm Lumen Grid partners with Ostrand's military for satellite network", summary: "The unlikely partnership between a consumer broadband company and the armed forces has prompted questions about data access and export rules." },
];

export function loadSampleData(db: DB): { articles: number; stories: number } {
  let articles = 0;
  SAMPLE.forEach((s, i) => {
    const r = insertArticle(db, {
      feedId: null,
      publisher: s.publisher,
      region: s.region,
      language: "en",
      isSample: true,
      item: { url: `https://example.org/sample/${i + 1}`, guid: `sample-${i + 1}`, title: s.title, summary: s.summary, author: null, publishedAt: hoursAgo(s.h), imageUrl: null },
    });
    if (r.outcome === "new") articles++;
  });
  const { clustersNew } = clusterPending(db);
  return { articles, stories: clustersNew };
}

export function removeSampleData(db: DB): number {
  const ids = (db.prepare("SELECT id FROM clusters WHERE is_sample = 1").all() as { id: string }[]).map((r) => r.id);
  db.transaction(() => {
    for (const id of ids) {
      db.prepare("DELETE FROM search_index WHERE kind = 'cluster' AND ref_id = ?").run(id);
      db.prepare("DELETE FROM clusters WHERE id = ?").run(id);
    }
    const arts = (db.prepare("SELECT id FROM articles WHERE is_sample = 1").all() as { id: string }[]).map((r) => r.id);
    for (const a of arts) db.prepare("DELETE FROM search_index WHERE kind = 'article' AND ref_id = ?").run(a);
    db.prepare("DELETE FROM articles WHERE is_sample = 1").run();
  })();
  return ids.length;
}
