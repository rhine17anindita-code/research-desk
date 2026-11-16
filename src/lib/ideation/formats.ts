/** Content formats the ideation system can target. */
export interface FormatDef {
  id: string;
  label: string;
  platform: string;
  medium: "visual" | "written";
  /** What a good idea for this format needs (fed to the AI). */
  craft: string;
}

export const CONTENT_FORMATS: FormatDef[] = [
  { id: "youtube-long", label: "YouTube video", platform: "YouTube", medium: "visual", craft: "8–20 min; a curiosity-gap title + thumbnail concept; a story with escalating reveals; strong cold open in the first 15 seconds." },
  { id: "short-video", label: "Short / Reel / TikTok", platform: "Shorts · Reels · TikTok", medium: "visual", craft: "30–90 s; one surprising fact or reveal in the first 2 seconds; a single idea; visual proof on screen; loopable ending." },
  { id: "carousel", label: "Carousel post", platform: "Instagram · LinkedIn", medium: "visual", craft: "6–10 slides; slide 1 is a bold claim or question; one fact per slide; a map, chart or document as proof; a closing takeaway." },
  { id: "thread", label: "Thread", platform: "X · Threads · Bluesky", medium: "written", craft: "8–14 posts; the first post states the surprising claim; each post adds evidence; links to sources; a closing line people quote." },
  { id: "explainer", label: "Written explainer", platform: "Blog · Substack · newspaper", medium: "written", craft: "1,200–2,000 words; answers one question people are actually asking; clear structure; sourced numbers." },
  { id: "op-ed", label: "Opinion piece / op-ed", platform: "Newspaper · magazine", medium: "written", craft: "700–1,000 words; one clear argument the reader has not heard; evidence; anticipates the counter-argument; a call to act." },
  { id: "essay", label: "Long-form essay", platform: "Magazine · Substack", medium: "written", craft: "2,500–5,000 words; a big idea connecting the news to history or structure; scenes and characters; original synthesis." },
  { id: "investigation", label: "Investigation", platform: "Any", medium: "written", craft: "A specific claim that can be proven with documents, data or testimony; names what must be obtained; clear stakes." },
  { id: "research-brief", label: "Research brief / paper", platform: "Think tank · academic", medium: "written", craft: "A precise research question; method and data sources; contribution beyond existing literature." },
  { id: "call-to-action", label: "Call to action / campaign", platform: "Any", medium: "written", craft: "A concrete ask of a named audience or institution; why now; evidence of the problem; a simple next step." },
  { id: "call-for-papers", label: "Call for papers / contributions", platform: "Academic · community", medium: "written", craft: "A theme with an open, important question; who should contribute; what kinds of evidence or perspectives are wanted." },
  { id: "podcast", label: "Podcast / audio episode", platform: "Spotify · YouTube", medium: "visual", craft: "A narrative or conversation built around one question; a guest or voice who knows something the audience does not." },
];

export const FORMAT_BY_ID = Object.fromEntries(CONTENT_FORMATS.map((f) => [f.id, f])) as Record<string, FormatDef>;

/** Kinds of "untold" angles, used to label ideas and learn which ones the user likes. */
export const ANGLE_TYPES: Record<string, string> = {
  "hidden-history": "Hidden history — the backstory nobody tells",
  "follow-the-money": "Follow the money — who pays, who profits",
  "contradiction": "Contradiction — what officials say vs what evidence shows",
  "local-angle": "Local angle — what this means for one place or community",
  "overlooked-people": "Overlooked people — those affected but unheard",
  "mechanism": "How it actually works — the machinery behind the headline",
  "connection": "Unexpected connection — two stories that are really one",
  "what-next": "What happens next — consequences nobody is modelling",
  "myth-busting": "Myth-busting — a popular belief the evidence contradicts",
  "explainer": "Plain explainer — the question everyone is quietly asking",
};
