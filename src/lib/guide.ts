/** The in-app guide: where to go for what, how the parts fit, and what costs money. Plain data. */

export interface GuideTask { want: string; go: string; href: string; how: string; cost: "free" | "ai" | "mixed"; tags: string }
export interface GuideArea { title: string; href: string; what: string; use: string[]; cost: string }

export const TASKS: GuideTask[] = [
  // Finding stories
  { want: "See what's breaking right now", go: "Discover → For you (Breaking strip at the top)", href: "/discover", how: "Stories first seen in the last 6 hours and headlines from the last 90 minutes. Press Refresh feeds for the very latest.", cost: "free", tags: "news latest breaking today headlines" },
  { want: "Read everything in time order", go: "Discover → Latest", href: "/discover?view=latest", how: "Newest stories first, no ranking.", cost: "free", tags: "news latest chronological" },
  { want: "Get story ideas for today", go: "Studio", href: "/studio", how: "Your daily desk: top stories for your channel, what's trending, talk shows, statements and untold angles.", cost: "mixed", tags: "ideas today dashboard home" },
  { want: "Hear what talk shows and podcasts are arguing about", go: "Studio → Talk shows (or Ideas → Talk shows for all)", href: "/ideas/talk", how: "Switch between Top picks and Latest. Open an episode for its key moments from the transcript.", cost: "free", tags: "talk shows podcasts videos tv bangla" },
  { want: "Find stories nobody's covering", go: "Ideas → Untold", href: "/ideas/untold", how: "Angles that are in the talk or the data but missing from the headlines.", cost: "mixed", tags: "untold gaps angles original" },
  { want: "See what creators like Johnny Harris or TLDR are making", go: "Ideas → Inspiration", href: "/ideas/inspiration", how: "Their latest videos and what's breaking out.", cost: "free", tags: "inspiration creators competitors" },
  { want: "Understand one story fast", go: "Open the story → editor's note, coverage timeline, research questions", href: "/discover", how: "Every outlet's version side by side, paywalled ones with free alternatives, Bangla translated to English.", cost: "mixed", tags: "story understand context coverage" },
  // Research
  { want: "Save a link, tweet, video or note to look at later", go: "My research", href: "/inbox", how: "Paste anything; videos get transcribed on the server.", cost: "free", tags: "save inbox bookmark link" },
  { want: "Know what experts, think tanks and other countries say", go: "Expert views (or the panel on any story/project)", href: "/experts", how: "Start on At a glance: key points pulled from the sources. Read it yourself, jump to it in the library, or Ask AI to read it for you.", cost: "mixed", tags: "experts solutions policy research papers opinion think tank law treaty history" },
  { want: "Find solutions with pros and cons", go: "Expert views → Solutions brief tab", href: "/experts", how: "Options, who acts, examples elsewhere, pros/cons, feasibility in Bangladesh — only from the library.", cost: "ai", tags: "solutions pros cons policy options" },
  { want: "Look up a term I don't know", go: "Key terms row in any expert library", href: "/experts", how: "Click a term for a plain definition.", cost: "free", tags: "define term meaning glossary" },
  { want: "Find something I saw before", go: "Search (or press ⌘K / Ctrl+K anywhere)", href: "/search", how: "Searches stories, articles, notes, sources and projects.", cost: "free", tags: "search find" },
  { want: "Keep sources and notes together for one video", go: "Projects → open a project", href: "/research", how: "Stories, sources, notes, questions, expert views and the script in one place.", cost: "free", tags: "project folder organise" },
  // Making
  { want: "Make a YouTube video end to end", go: "YouTube → Make a video", href: "/youtube", how: "Pick an idea; the producer does brief → research → outline → script → package. Then record with the teleprompter.", cost: "ai", tags: "youtube video produce make" },
  { want: "Write a script in my voice", go: "Project → Script tab", href: "/research", how: "Hooks → outline → draft, step by step. Select any passage to rewrite it.", cost: "ai", tags: "script write draft hook outline" },
  { want: "Know how long my script runs out loud", go: "The ⏱ bar above any script", href: "/research", how: "Uses your own reading pace (measure it once), adds clips and sound bites, and tells you how many words to cut. Shorts are checked against 3:00.", cost: "free", tags: "read time length minutes shorts duration wpm pace" },
  { want: "Add a solutions section to a script", go: "Script tab or YouTube producer → tick Include a solutions section", href: "/research", how: "The outline and script add an even-handed “what would fix this” part, backed by expert views.", cost: "ai", tags: "solutions script section" },
  { want: "Read my script on camera", go: "YouTube producer → Teleprompter", href: "/youtube", how: "Space = play/pause, arrows = speed, M = mirror.", cost: "free", tags: "teleprompter record camera" },
  { want: "Make scripts sound more like me", go: "Voice Lab", href: "/voice", how: "Add your past scripts or videos, set the dials, ban phrases. Edits you make teach future scripts.", cost: "mixed", tags: "voice style tone personalise" },
  { want: "Plan when things go out", go: "Calendar", href: "/calendar", how: "Drag projects onto dates.", cost: "free", tags: "calendar schedule plan" },
  // Growing
  { want: "See how my posts are doing", go: "Performance", href: "/performance", how: "YouTube, Instagram and Facebook numbers, comments and what's working.", cost: "mixed", tags: "analytics views performance comments" },
  { want: "Find sponsors or ways to make money", go: "Monetise", href: "/monetise", how: "Brand-safe sponsors, rate card, series ideas and proposals.", cost: "free", tags: "money sponsor brand deal rate" },
  // Setup
  { want: "Tell the app what I care about (and what to ignore)", go: "Preferences", href: "/preferences", how: "Focus and mute terms, channels, talk shows on/off.", cost: "free", tags: "preferences mute focus topics" },
  { want: "Change how often news updates", go: "Studio → the bar at the top (Checks by itself every…)", href: "/studio", how: "5, 10, 15, 30 or 60 minutes.", cost: "free", tags: "refresh interval update frequency" },
  { want: "Add or remove news sources", go: "Settings → Sources", href: "/settings?tab=sources", how: "Feeds, outlets and topic watches.", cost: "free", tags: "sources feeds outlets rss" },
  { want: "Get transcripts of videos, Reels and TikToks", go: "Settings → Connections (one-time)", href: "/settings?tab=connections", how: "Paste a free Supadata key once; transcripts then come from the server, on any device.", cost: "free", tags: "transcript video reels tiktok instagram supadata connect" },
  { want: "Use KNDL on my phone or another computer", go: "Just open kndl.newthingmedia.org and sign in", href: "/guide", how: "Everything runs on the server — any device, any time. Add it to your home screen from the browser's Share/⋮ menu.", cost: "free", tags: "phone mobile device laptop share access other people team" },
  { want: "Check or change the AI budget", go: "Settings → AI & usage", href: "/settings?tab=ai", how: "Daily and monthly limits; every AI button shows its cost first.", cost: "free", tags: "budget ai cost money usage" },
];

export const AREAS: GuideArea[] = [
  { title: "Studio", href: "/studio", what: "Your home screen for today.", use: ["Top stories for the channel you're on", "Talk shows, statements, trends and untold angles", "The bar at the top shows when news last updated"], cost: "Free to browse; idea buttons use AI." },
  { title: "Discover", href: "/discover", what: "Every story from every outlet, grouped and ranked.", use: ["Breaking strip: last 6 hours + last 90 minutes", "For you = ranked for your interests; Latest = newest first", "Open a story for coverage, research questions and expert views"], cost: "Free; the AI brief and assessments are optional." },
  { title: "My research", href: "/inbox", what: "Your inbox for anything you find elsewhere.", use: ["Paste links, posts, videos, notes", "Videos and Reels get transcribed on the server"], cost: "Free." },
  { title: "Expert views", href: "/experts", what: "What researchers, think tanks, governments and commentators say — and the solutions.", use: ["At a glance first, the full library behind it", "Filter by type or by Solutions / Other countries / History / Laws / Bangladesh", "★ keep items; in a project they become citable sources"], cost: "Gathering and the summary are free; Ask AI is a fraction of a cent; the Solutions brief is a few cents." },
  { title: "Projects", href: "/research", what: "One folder per piece of content.", use: ["Stories, sources, notes and questions together", "Script tab: hooks → outline → draft in your voice, with the ⏱ read-time bar", "YouTube and Monetise panels"], cost: "Free to organise; writing uses AI." },
  { title: "YouTube", href: "/youtube", what: "A full producer for @aninditarhine and Rhine Reviews.", use: ["Make a video: pick an idea and press Produce everything", "Plan, formats, set guide, competitors, title checker", "Teleprompter and recording pack"], cost: "A full video is usually around $1 of AI." },
  { title: "Voice Lab", href: "/voice", what: "Teaches the writer how you sound.", use: ["Upload or link your scripts and videos", "Dials (energy, humour, formality…) and presets", "Banned phrases"], cost: "Analysing your voice uses a little AI." },
  { title: "Performance & Monetise", href: "/performance", what: "How you're doing and how to earn from it.", use: ["Numbers and comments from YouTube, Instagram and Facebook", "Sponsors, rate card and proposals"], cost: "Mostly free." },
];

export const DAY = [
  ["Morning", "Open Studio. Scan the Breaking strip in Discover and the talk shows (Latest)."],
  ["Pick", "Open the story that grabs you. Read the editor's note, then Expert views → At a glance."],
  ["Collect", "Add it to a project. ★ keep the expert items you trust; drop anything else into My research."],
  ["Write", "YouTube → Make a video (or the project's Script tab). Tick Include a solutions section if it fits."],
  ["Time it", "Watch the ⏱ bar: Shorts under 3:00, long videos inside the format's range. Add clips you'll play."],
  ["Record", "Teleprompter, then the recording pack goes to your editor."],
];

export const TROUBLE: [string, string][] = [
  ["The news looks old", "Press Refresh feeds on Discover, or set Checks by itself every 5–10 minutes on Studio. The server checks by itself; nothing depends on your computer."],
  ["Talk shows look old", "Switch the Talk shows list to Latest. Press its ↻ button to pull new episodes."],
  ["A transcript is missing", "Transcripts come from the server through the transcript service (Settings → Connections, free plan 100 a month). They arrive within about 10 minutes. YouTube doesn't block it."],
  ["Bangla text", "Headlines are translated to English automatically (free). For a whole Bangla transcript, press “Translate to English” on the episode."],
  ["An AI button is greyed out", "You've hit the daily or monthly budget, or the AI key is missing. Settings → AI & usage."],
  ["The read time feels wrong", "Measure your pace once (⏱ bar → Measure my reading pace). Add clips that play while you're silent."],
];

export const SHORTCUTS: [string, string][] = [
  ["⌘K / Ctrl+K", "Jump to anything"],
  ["↻ next to a section", "Refresh just that section"],
  ["☆ / ★", "Keep an item"],
  ["▸ Clip … (0:20)", "In a script, counts the clip in the read time"],
  ["Space · ↑ ↓ · + − · M", "Teleprompter: play, speed, size, mirror"],
];
