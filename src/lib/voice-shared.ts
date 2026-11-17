/** Voice Lab settings shared by the server and the browser. */

export interface Dial { id: string; left: string; right: string; def: number; hint: string }

export const DIALS: Dial[] = [
  { id: "tone", left: "Serious", right: "Playful", def: 40, hint: "Overall feel" },
  { id: "stance", left: "Neutral explainer", right: "Clear opinion", def: 60, hint: "How much you take a side" },
  { id: "mood", left: "Hopeful", right: "Critical", def: 60, hint: "Sentiment towards the subject" },
  { id: "energy", left: "Calm", right: "Urgent", def: 55, hint: "Delivery energy" },
  { id: "register", left: "Formal", right: "Chatty", def: 75, hint: "Like a lecture vs like talking to a friend" },
  { id: "banglish", left: "No Banglish", right: "Lots of Banglish", def: 25, hint: "Bangla/Banglish words and phrases" },
  { id: "humour", left: "No jokes", right: "Lots of humour", def: 35, hint: "Wit, sarcasm, asides" },
  { id: "evidence", left: "Story-led", right: "Data-heavy", def: 50, hint: "Narrative vs numbers" },
  { id: "personal", left: "Impersonal", right: "Personal", def: 50, hint: "Your own experience, \"I\", feelings" },
  { id: "pace", left: "Slow, reflective", right: "Fast, punchy", def: 65, hint: "Sentence length and rhythm" },
  { id: "emotion", left: "Restrained", right: "Emotional", def: 45, hint: "How much feeling shows" },
  { id: "complexity", left: "Simple", right: "Nuanced", def: 55, hint: "Explain like to a teenager vs a policy nerd" },
];

/** How much of your inspirations' style to borrow (0 = only your voice). */
export const BLEND = { id: "blend", left: "Only my voice", right: "Mostly my inspirations", def: 25 };

export type Dials = Record<string, number>;
export interface Preset { name: string; dials: Dials }

export const defaultDials = (): Dials => Object.fromEntries([...DIALS, BLEND].map((d) => [d.id, d.def]));

/** Phrases that make writing sound like AI. Yours to edit in Voice Lab. */
export const DEFAULT_BANNED = [
  "in today's video", "let's dive in", "dive into", "delve", "tapestry", "it's worth noting", "it is important to note", "in conclusion",
  "game-changer", "buckle up", "here's the kicker", "the stakes have never been higher", "navigate the complexities", "ever-evolving",
  "a testament to", "shed light on", "at the end of the day", "it remains to be seen", "stay tuned", "smash that like button",
  "let that sink in", "make no mistake", "in the realm of", "multifaceted", "pivotal", "underscores", "a stark reminder", "unpack",
  "a deep dive", "landscape of", "rich history", "plays a crucial role", "not just", "more than just",
].join("\n");

export function dialWord(v: number, left: string, right: string): string | null {
  if (v <= 15) return `strongly ${left.toLowerCase()}`;
  if (v <= 35) return `leaning ${left.toLowerCase()}`;
  if (v < 65) return null; // balanced: no instruction
  if (v < 85) return `leaning ${right.toLowerCase()}`;
  return `strongly ${right.toLowerCase()}`;
}
