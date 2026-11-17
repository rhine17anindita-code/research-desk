import type { DB } from "../db";
import { getYtChannel } from "./index";
import { FORMATS } from "./guide";
import { performanceBrief } from "../performance/patterns";
import { prefsBlock } from "../prefs";
import { jaccard, uniqueTokens } from "../text";

/**
 * The strategist's playbook: what reliably works on YouTube for explainer/news-analysis
 * channels, written down so every AI step works from it — plus live evidence (competitors'
 * breakouts, the creator's own numbers, real search terms). This is a written playbook and
 * evidence, not a trained model.
 */
export const PLAYBOOK = `YOUTUBE STRATEGY PLAYBOOK (follow it)

IDEA SELECTION
- A video is an answer to a question real people are already asking, or a story they don't know they want yet. Prefer ideas with proof: a competitor's breakout on the topic, search demand, or a story many outlets cover but nobody has explained well.
- Every idea needs a specific, surprising promise ("the real reason…", "what nobody tells you about…", "I read the document…"). If the promise is generic, the idea isn't ready.
- Bangladesh lens: connect global stories to what they mean for Bangladesh and for a 22-year-old in Dhaka. Local stories: explain the mechanism (money, power, history) under the headline.
- Evergreen beats news for long-term watch hours; news beats evergreen for speed. Mix both.

PACKAGING (title + thumbnail are decided before the script)
- The title makes one clear promise and creates a curiosity gap without lying. 40–60 characters. Front-load the subject. Specific > vague (names, numbers, places).
- Levers: curiosity ("The real reason…"), stakes ("…could start a war"), contrarian ("Why X is wrong about Y"), specificity ("I read all 300 pages…"), identity/relevance ("…what it means for Bangladesh").
- Thumbnail: one focal point (face with a clear emotion OR one striking object/map), ≤4 words that ADD to the title, high contrast, readable at phone size.
- Title, thumbnail and the first line must tell the same story.

HOOK (first 30 seconds decide everything)
- Line one restates the promise with the most surprising fact or the question — no greeting, no channel intro, no "in this video".
- Within 15 seconds: why it matters now and what they'll understand by the end. Open a loop you close only at the end.
- Show proof early (a document, a number, a map) to earn trust.

STRUCTURE & RETENTION
- Escalating beats: each section reveals something bigger than the last, ending on a mini-cliffhanger into the next ("but that's not the strange part").
- Context only when needed, in one or two lines; never front-load background.
- Every 5–10 seconds something changes on screen; write ▸ visual notes accordingly.
- Re-hook at the midpoint with a twist or counterpoint.
- Pay off the title's promise clearly before the end; end fast with one question for comments and a pointer to the next video. No long outros.

CREDIBILITY (news & politics)
- Facts cited to sources; allegations labelled as allegations; numbers checked; both sides fairly stated before the take.
- Avoid graphic content, slurs and inflammatory wording (keeps ads on). Never invent quotes.

FORMATS & LENGTH
- Watch hours come from long videos (8–15 min). Shorts are for discovery: cut 3–5 from each long video, each with its own hook.
- Series with a name build habit and are easier to sell to sponsors.`;

/** Live evidence for one idea: competitors' related breakouts, own patterns, preferences. */
export function evidenceBlock(db: DB, ytChannelId: string | null, topic: string): string {
  const yt = ytChannelId ? getYtChannel(db, ytChannelId) : null;
  const toks = new Set(uniqueTokens(topic));
  const rows = ytChannelId
    ? (db.prepare(
        `SELECT v.title, v.views, c.name, (SELECT AVG(views) FROM yt_comp_videos WHERE competitor_id = c.id) AS avg FROM yt_comp_videos v JOIN yt_competitors c ON c.id = v.competitor_id
         WHERE c.yt_channel_id = ? AND v.views IS NOT NULL`,
      ).all(ytChannelId) as { title: string; views: number; name: string; avg: number }[])
    : [];
  const scored = rows.map((r) => ({ ...r, mult: r.avg ? r.views / r.avg : 0, sim: jaccard(toks, new Set(uniqueTokens(r.title))) }));
  const related = scored.filter((r) => r.sim >= 0.12).sort((a, b) => b.sim - a.sim).slice(0, 6);
  const top = [...scored].sort((a, b) => b.mult - a.mult).slice(0, 8);
  const perf = performanceBrief(db);
  return [
    yt ? `CHANNEL: ${yt.name} — ${yt.niche}. Promise: ${yt.positioning || "(not set)"}. Audience: ${yt.audience || "18–30, Bangladesh, English-speaking"}. Series/pillars: ${yt.pillars.join("; ")}.` : "",
    related.length ? `COMPETITOR VIDEOS ON THIS TOPIC (title — views — × their average):\n${related.map((r) => `- ${r.name}: “${r.title}” — ${Math.round(r.views).toLocaleString()} — ${r.mult.toFixed(1)}×`).join("\n")}` : "",
    top.length ? `WHAT'S BREAKING OUT FOR COMPETITORS (packaging lessons):\n${top.map((r) => `- ${r.name}: “${r.title}” — ${r.mult.toFixed(1)}×`).join("\n")}` : "",
    perf ? `THE CREATOR'S OWN NUMBERS:\n${perf.split("\n").slice(0, 18).join("\n")}` : "",
    prefsBlock(db),
  ].filter(Boolean).join("\n\n");
}

/** Pick the format from the topic when the brief doesn't. */
export function guessFormat(text: string): string {
  if (/\b(budget|report|verdict|treaty|agreement|bill|act|white paper|document|ordinance)\b/i.test(text)) return "doc-breakdown";
  if (/\b(india|china|myanmar|pakistan|border|river|teesta|war|iran|israel|gaza|us|russia|map|sea|strait)\b/i.test(text)) return "map-explainer";
  if (/\b(taka|price|inflation|loan|salary|remittance|bank|economy|tax|money)\b/i.test(text)) return "money-explainer";
  if (/\b(history|myth|origin|forgotten|1971|1952|mughal|british|colonial|ancient)\b/i.test(text)) return "history-story";
  return "desk-explainer";
}

export const FORMAT_IDS = FORMATS.map((f) => f.id);
