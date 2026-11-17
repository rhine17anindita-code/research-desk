/** Channel preferences: what to cover, in which formats, how bold. Shared by server and browser. */

export const TOPICS = [
  { id: "bd-politics", label: "Bangladesh politics & power" },
  { id: "economy", label: "Economy, money & prices" },
  { id: "geopolitics", label: "Geopolitics & neighbours (India, China, US, Myanmar…)" },
  { id: "rights", label: "Rights, justice & courts" },
  { id: "climate", label: "Climate, disasters & environment" },
  { id: "tech", label: "Tech, internet & social media" },
  { id: "culture", label: "Culture, film, books & society" },
  { id: "history", label: "History & \"the real story behind\"" },
  { id: "world", label: "World news (not about Bangladesh)" },
  { id: "youth", label: "Youth, education & jobs" },
] as const;

export const FORMATS = [
  { id: "short", label: "Shorts / Reels / TikToks" },
  { id: "long", label: "Long YouTube videos" },
  { id: "carousel", label: "Carousels" },
  { id: "talking", label: "Talking-head takes" },
  { id: "written", label: "Written posts / threads" },
] as const;

export interface Prefs {
  topics: Record<string, number>; // 0 = never, 50 = normal, 100 = as much as possible
  formats: Record<string, number>;
  boldness: number; // 0 safe & balanced … 100 provocative hot takes
  depth: number; // 0 quick & light … 100 deep investigations
  audienceQuestions: number; // 0 researcher questions … 100 viewer questions
  notes: boolean; // automatic editor's notes on top stories
}

export const defaultPrefs = (): Prefs => ({
  topics: Object.fromEntries(TOPICS.map((t) => [t.id, t.id === "world" ? 30 : 50])),
  formats: { short: 70, long: 40, carousel: 30, talking: 40, written: 10 },
  boldness: 50,
  depth: 55,
  audienceQuestions: 60,
  notes: true,
});

const word = (v: number) => (v >= 85 ? "as much as possible" : v >= 65 ? "more than usual" : v >= 35 ? "normal amount" : v >= 10 ? "rarely" : "never");

/** Preferences as instructions for AI prompts (only what differs from neutral). */
export function prefsText(p: Prefs): string {
  const topics = TOPICS.map((t) => [t.label, p.topics[t.id] ?? 50] as const).filter(([, v]) => v <= 30 || v >= 65);
  const formats = FORMATS.map((f) => [f.label, p.formats[f.id] ?? 30] as const).sort((a, b) => b[1] - a[1]);
  return [
    topics.length ? `TOPIC MIX THE CREATOR SET: ${topics.map(([l, v]) => `${l}: ${word(v)}`).join("; ")}` : "",
    `FORMAT MIX (most wanted first): ${formats.filter(([, v]) => v > 5).map(([l, v]) => `${l} (${v})`).join(", ")}`,
    p.boldness >= 65 ? "BOLDNESS: they want strong, provocative takes (still factual)." : p.boldness <= 35 ? "BOLDNESS: keep it balanced and careful; no hot takes." : "",
    p.depth >= 65 ? "DEPTH: prefer deeper, investigative pieces over quick news." : p.depth <= 35 ? "DEPTH: prefer quick, light, fast-to-make pieces." : "",
  ].filter(Boolean).join("\n");
}
