/**
 * The YouTube playbook: formats you can make solo, the set, the workflow, packaging and the rules.
 * Written for an on-camera creator in Dhaka with a camera, mic and lights, editing in CapCut,
 * solo at 20+ hours a week, aiming to reach monetisation fast. Plain knowledge — no AI.
 */

export interface YtFormat {
  id: string;
  name: string;
  what: string;
  why: string;
  length: string;
  hours: number; // solo hours from idea to upload, once practised
  difficulty: "easy" | "medium" | "hard";
  kit: string[];
  structure: string[]; // the beat sheet
  edit: string[]; // CapCut notes
  thumbnail: string;
  titles: string[];
  examples: string;
  ypp: string; // how it helps monetisation
}

export const FORMATS: YtFormat[] = [
  {
    id: "desk-explainer", name: "Desk explainer (your core format)", what: "You on camera at your set, explaining one story with on-screen proof: documents, maps, headlines, numbers.",
    why: "Fast to make, builds trust in you as the face, and it's exactly what your best Shorts already do — just 8–12 minutes long, which earns watch hours.",
    length: "8–12 min", hours: 10, difficulty: "easy", kit: ["Camera at eye level", "Mic", "Key + fill light", "Teleprompter app on a phone/tablet"],
    structure: ["Cold open (0:00–0:20): the most surprising fact or the question, no greeting", "Promise (0:20–0:40): what they'll understand by the end", "Context in 60 seconds: only what's needed", "Beat 1 → mini-payoff", "Beat 2 → twist or counterpoint (‘But here's the thing’)", "Beat 3 → what it means for Bangladesh / for you", "Payoff: answer the title's question", "End: one question for comments + the next video on screen (end screen)"],
    edit: ["Cut every pause and breath at the start of sentences (jump cuts are fine for this format)", "Zoom in 110–115% on punchlines; back out on the next beat", "Every 5–10 seconds something changes on screen: a document, a headline, a number, a map", "Auto-captions on (CapCut → Text → Auto captions), styled once and saved as a preset", "Music very low under talking, off on key lines"],
    thumbnail: "Your face with a clear emotion + one object/map/document + ≤4 words.", titles: ["Why [X] is [surprising claim]", "The real reason [event happened]", "[Country/Person] just did [thing] — here's what it means for Bangladesh"],
    examples: "Johnny Harris (desk segments), TLDR News, Dhruv Rathee's explainer structure.", ypp: "Best watch-hour engine for a solo creator: one per week gets you there fastest.",
  },
  {
    id: "map-explainer", name: "Map explainer", what: "A geopolitics or history story told over a map: borders, rivers, trade routes, armies — with you introducing and closing on camera.",
    why: "Maps are the most-watched explainer visuals on YouTube and work for Geopolitics, History and the main channel. Bangladesh-India-China-Myanmar stories are made for maps.",
    length: "10–15 min", hours: 14, difficulty: "medium", kit: ["Desk set for intro/outro", "Map screenshots (Google Earth/Maps, Wikimedia Commons maps)", "CapCut keyframes for zooms and arrows"],
    structure: ["Cold open on the map: zoom from the world to the place", "The question in one line", "Geography first: why this place matters", "History in three beats", "Today's situation", "What happens next — scenarios", "What it means for Bangladesh", "Close on camera"],
    edit: ["Use Google Earth Studio or screen recordings of Google Earth for zooms (credit the data provider shown)", "Keyframe arrows/labels in CapCut; keep a reusable label style", "One map change every 5–8 seconds"],
    thumbnail: "A bold, simplified map with one highlighted area + an arrow + 2–3 words.", titles: ["Why [place] is the most important [X] in South Asia", "How [river/border] could start a war", "The map that explains [conflict]"],
    examples: "RealLifeLore, Johnny Harris, Caspian Report.", ypp: "Long average view duration — strong for watch hours. Pairs well with the Geopolitics niche.",
  },
  {
    id: "doc-breakdown", name: "“I read the document so you don't have to”", what: "You go through a budget, a treaty, a court verdict or a report and pull out what matters, showing the pages on screen.",
    why: "Nobody else does the reading — it's original by default, very shareable, and builds authority. Perfect for Money and the main channel.",
    length: "8–14 min", hours: 12, difficulty: "medium", kit: ["Desk set", "PDF on screen (screen recording) with highlights"],
    structure: ["What the document is and why it matters today", "The 3–5 things in it nobody is talking about", "What's missing from it", "What it means for ordinary people", "Your verdict"],
    edit: ["Screen-record the PDF; highlight lines in yellow; zoom to the line", "Cut to camera for your reaction after each finding"],
    thumbnail: "The document's cover/page with a highlighter mark + your surprised face + ‘Page 47’.", titles: ["I read all 300 pages of the budget. Here's what they didn't tell you", "What's actually in the [treaty/deal]"],
    examples: "Legal/finance explainer channels; journalists' document breakdowns.", ypp: "Evergreen within its topic for months; searchable.",
  },
  {
    id: "weekly-roundup", name: "Weekly roundup: “This week in Bangladesh”", what: "A recurring 10-minute show: the 4–6 stories that mattered this week, with your take on the one that matters most.",
    why: "A fixed weekly slot builds a habit and is easy to plan; uses the Desk's news feeds directly. Sponsors like recurring shows.",
    length: "10–14 min", hours: 9, difficulty: "easy", kit: ["Desk set", "Headline cards template"],
    structure: ["Cold open: the week's biggest moment", "Story 1–5, about 90 seconds each, with one fact and one ‘why it matters’", "The one that matters most — deeper", "What to watch next week", "Comment question"],
    edit: ["Reusable headline-card template in CapCut", "Chapters for each story (they become timestamps in the description)"],
    thumbnail: "Same layout every week (brand recognition) + this week's biggest image + week number.", titles: ["This week in Bangladesh: [biggest story]", "5 things that happened in Bangladesh this week"],
    examples: "TLDR Daily-style recaps; Last Week Tonight's structure (without the comedy budget).", ypp: "Reliable weekly watch hours; easy to batch.",
  },
  {
    id: "history-story", name: "History story (“The real story behind…”)", what: "One surprising story from the past told as a narrative, with you on camera and archive images, maps and old photos.",
    why: "Evergreen — keeps earning views for years, which watch hours love. Brand-safe for sponsors. Feeds the History niche.",
    length: "10–20 min", hours: 14, difficulty: "medium", kit: ["Desk or a ‘story corner’ set", "Archive images (Wikimedia Commons, public-domain archives)", "Slow zooms (Ken Burns) in CapCut"],
    structure: ["Cold open: a scene or the myth everyone believes", "Who, where, when — fast", "Rising tension: what went wrong", "The turn", "What really happened (debunk/reveal)", "Why it still matters today", "Close"],
    edit: ["Slow zooms on still images; sound design (paper, wind) at low volume", "Date/place cards in a consistent style"],
    thumbnail: "An old photo/painting with one modern element or a bold contradiction + 2–3 words.", titles: ["The myth about [X] that everyone in Bangladesh believes", "The forgotten [event] that changed Bengal", "Why [place] is called [name]"],
    examples: "Johnny Harris history pieces, Kings and Generals (style), Oversimplified (structure).", ypp: "Best long-term earner; long sessions.",
  },
  {
    id: "money-explainer", name: "Money explainer", what: "One money question (prices, taka, loans, remittances, salaries) answered with simple charts and examples in taka.",
    why: "High advertiser value (finance ads pay more), brand-friendly for banks/MFS sponsors, and young audiences search for it.",
    length: "6–10 min", hours: 9, difficulty: "easy", kit: ["Desk set", "Simple charts (Google Sheets → screenshot, or CapCut shapes)"],
    structure: ["The question in their words", "The short answer", "How it actually works (one diagram)", "A real example in taka", "What you can do about it", "Myth to drop"],
    edit: ["One chart per idea; animate the number counting up", "Taka symbol and amounts big on screen"],
    thumbnail: "A big ৳ amount or a price tag + your reaction + 2–3 words.", titles: ["Why is everything getting more expensive in Bangladesh?", "Where your remittance fee actually goes", "The taka explained in 8 minutes"],
    examples: "Finance explainers like Ali Abdaal's structure, Dhruv Rathee's economy videos.", ypp: "Higher RPM (earnings per 1,000 views) than general news.",
  },
  {
    id: "reaction-commentary", name: "Commentary on a talk show or speech", what: "You react to and fact-check a clip from a talk show, a speech or a viral video — adding analysis, not just watching.",
    why: "Fast to make and topical; the Desk's talk-show radar and transcripts find the moments for you.",
    length: "8–12 min", hours: 7, difficulty: "easy", kit: ["Desk set", "Short clips only (see Rules: fair use)"],
    structure: ["What was said (short clip or quote card)", "Context they left out", "Fact-check with sources", "What it really means", "Your take"],
    edit: ["Keep clips short (a few seconds) and talk over/around them; quote cards are safer than clips", "Never upload long stretches of someone else's video"],
    thumbnail: "Speaker's still (small) + your face + ‘TRUE?’ or a short quote.", titles: ["Fact-checking [person]'s claim about [X]", "What [show] got wrong about [X]"],
    examples: "Fact-check and commentary channels.", ypp: "Quick volume, but Content ID risk — keep clips minimal; quote cards are safest.",
  },
  {
    id: "interview", name: "Interview / conversation", what: "A 20–40 minute conversation with an expert, journalist or someone affected — remote or in person.",
    why: "The guest brings their audience and authority; Shorts cut from it are easy. Feeds a podcast later.",
    length: "20–45 min", hours: 8, difficulty: "medium", kit: ["Two mics", "Riverside/Zoom for remote (record locally)", "Second camera or phone for a wide shot"],
    structure: ["Cold open: the best 20 seconds of the conversation", "Who they are and why now", "Warm-up question", "Substance (5–8 questions)", "The hard question", "What's next", "Where to find them"],
    edit: ["Cut to the best answers; keep the flow natural", "Lower-third names; chapters per question", "3–5 Shorts from the best answers"],
    thumbnail: "Both faces + a bold quote from the guest.", titles: ["[Expert] explains why [X]", "“[Shocking quote]” — [guest name]"],
    examples: "Diary of a CEO (structure), Lex Fridman (long form).", ypp: "Long videos = big watch hours per view.",
  },
  {
    id: "shorts-cutdown", name: "Shorts cut from a long video", what: "3–5 vertical clips from each long video, each with its own hook, captions and a pointer to the full video.",
    why: "Shorts bring subscribers; the ‘Related video’ link sends them to the long one (watch hours). Almost free once the long video exists.",
    length: "30–60 s", hours: 1, difficulty: "easy", kit: ["The long video's footage (shoot 4K or leave space for a vertical crop)"],
    structure: ["Hook line (first 1–2 seconds, on-screen text)", "One fact or reveal", "Payoff", "‘Full story in the linked video’"],
    edit: ["CapCut: reframe to 9:16, auto captions, big text for the hook", "Add the long video as the ‘Related video’ when uploading the Short"],
    thumbnail: "Not needed (choose a strong first frame).", titles: ["Short, curiosity-driven, under 40 characters"],
    examples: "Every big explainer channel does this.", ypp: "Counts towards Shorts views and drives viewers to long-form watch hours.",
  },
  {
    id: "standalone-short", name: "Standalone Short", what: "A 45–60 second explainer made for vertical from the start (your current style).",
    why: "Fast discovery and subscribers; keep doing these, but pair them with long videos for watch hours.",
    length: "45–60 s", hours: 2, difficulty: "easy", kit: ["Camera in vertical or 4K crop", "Teleprompter"],
    structure: ["Hook in the first line", "One fact per ~10 seconds", "Twist", "Comment question"],
    edit: ["Captions always", "Cut every gap", "Loopable last line when possible"],
    thumbnail: "First frame = the hook text.", titles: ["Under 40 characters, a question or a bold claim"],
    examples: "Your own top Shorts (Iran, USA and Bangladesh — 3.2× your usual).", ypp: "Shorts views count only on the Shorts route to monetisation; subscribers count everywhere.",
  },
  {
    id: "list-video", name: "List video (“5 things…”)", what: "A numbered list on one theme: 5 myths, 7 places, 10 numbers.",
    why: "Easy to script and watch; strong search and browse performance; great for History and Money.",
    length: "8–12 min", hours: 9, difficulty: "easy", kit: ["Desk set", "Number cards template"],
    structure: ["Hook: the most surprising item first as a teaser", "Items in rising order of surprise", "Best item last", "Comment question: what did I miss?"],
    edit: ["Number cards between items; chapters per item"],
    thumbnail: "A big number + one striking image.", titles: ["5 myths about Bangladesh's history everyone believes", "7 numbers that explain Bangladesh's economy"],
    examples: "Common across explainer channels.", ypp: "Solid watch time; chapters help retention.",
  },
  {
    id: "on-location", name: "On-location explainer", what: "You at the place: a market, a river, a historic site — explaining while walking, with phone/gimbal B-roll.",
    why: "Instantly more original and memorable than desk videos; strong for History, Money (prices at the market) and climate stories.",
    length: "8–15 min", hours: 18, difficulty: "hard", kit: ["Wireless lav mic (essential outdoors)", "Phone gimbal or camera with stabilisation", "ND filter for daylight if using a camera"],
    structure: ["Open on location with the question", "Show, don't tell: what we're looking at", "History/context", "People or prices (with consent)", "What it means", "Close at the most visual spot"],
    edit: ["Wind and traffic noise: use the lav, add CapCut noise reduction lightly", "B-roll every few seconds; slow pans"],
    thumbnail: "You in the place with the striking element behind + 2–3 words.", titles: ["I went to [place] to find out why [X]", "What [market/river] tells you about Bangladesh's economy"],
    examples: "Johnny Harris field pieces.", ypp: "High retention and shareability; do one a month, not every week.",
  },
  {
    id: "live", name: "Live Q&A / live news breakdown", what: "A live stream answering questions on the week's biggest story, or reacting as news breaks.",
    why: "Live streams build loyal community, count as watch time, and Super Chat earns once eligible.",
    length: "30–60 min", hours: 2, difficulty: "easy", kit: ["Desk set", "Stable internet + UPS/IPS for load-shedding", "OBS or YouTube's own live studio"],
    structure: ["Topic and rules up front", "Answer the top questions", "Pin key links", "Tease the next video"],
    edit: ["Cut highlights into Shorts afterwards"],
    thumbnail: "LIVE + topic + your face.", titles: ["LIVE: your questions about [story]"],
    examples: "Many news creators run a weekly live.", ypp: "Adds watch hours cheaply; builds loyal viewers.",
  },
];

// ---------------------------------------------------------------------------
// Set, lighting, sound, camera — for a home room in Dhaka
// ---------------------------------------------------------------------------

export interface GuideSection { id: string; title: string; intro: string; checks: { key: string; text: string; why?: string }[] }

export const SET_GUIDE: GuideSection[] = [
  {
    id: "room", title: "The room", intro: "Pick the quietest room with space for you to sit 1.5–2 m in front of the background. Depth behind you is what makes a set look professional.",
    checks: [
      { key: "room-depth", text: "Sit at least 1.5 m away from the wall behind you", why: "Separation makes the background soft and gives a 3D look." },
      { key: "room-quiet", text: "Choose the side of the home away from the road; record when traffic is lowest (late night/early morning)", why: "Dhaka traffic and construction noise is the biggest audio problem." },
      { key: "room-fans", text: "Fan and AC off while recording (cool the room first)", why: "Fans and AC are constant hum that ruins voice quality." },
      { key: "room-soft", text: "Add soft things: curtains, rug, bookshelf, cushions, a sofa behind the camera", why: "Bare walls and tiles echo; soft surfaces absorb it." },
      { key: "room-power", text: "Lights and camera on a UPS/IPS (or have a power bank and battery lights)", why: "Load-shedding mid-take loses the whole setup." },
    ],
  },
  {
    id: "background", title: "Background & set", intro: "A background should say who you are in one glance and stay the same every video (that's your brand).",
    checks: [
      { key: "bg-identity", text: "2–3 identity props: books on history/politics, a map of Bangladesh or South Asia, one plant", why: "Signals ‘explainer about Bangladesh and the world’ instantly." },
      { key: "bg-practical", text: "One or two practical lights in the background (a small lamp, an LED strip behind the shelf) in your accent colour", why: "Coloured background light adds depth and a signature look." },
      { key: "bg-clutter", text: "Remove clutter, wires, open doors, bright windows and anything with text you don't want on screen", why: "Clutter distracts; text gets read." },
      { key: "bg-consistent", text: "Mark the camera, chair and light positions with tape so every video looks the same", why: "Consistency = brand; also saves setup time." },
      { key: "bg-no-window", text: "Never sit with a window behind you", why: "The camera exposes for the window and you become a silhouette." },
      { key: "bg-colour", text: "Pick an accent colour (your brand colour) and use it in the set light, lower-thirds and thumbnails" },
    ],
  },
  {
    id: "lighting", title: "Lighting", intro: "Three-point lighting with what you have. The goal: a bright, soft face; a slightly darker, coloured background.",
    checks: [
      { key: "li-key", text: "Key light 45° to one side, slightly above eye level, with a softbox or diffusion (or bounce it off a white wall)", why: "Soft light from the side shapes your face and looks cinematic." },
      { key: "li-fill", text: "Fill on the other side at about half the brightness (or a white board/reflector)", why: "Softens shadows without flattening the face." },
      { key: "li-back", text: "Back/hair light behind you, out of frame, pointing at your head and shoulders", why: "Separates you from the background." },
      { key: "li-temp", text: "All lights the same colour temperature (5600K daylight or 3200K warm) — never mix with window or room lights", why: "Mixed light gives orange/blue skin." },
      { key: "li-eyes", text: "Check for a catchlight (a small reflection) in your eyes", why: "Eyes look alive on camera." },
      { key: "li-room-off", text: "Turn off overhead tube lights", why: "Top light makes eye-socket shadows and can flicker." },
    ],
  },
  {
    id: "camera", title: "Camera & framing", intro: "Bangladesh mains power is 50 Hz: shoot at 25 or 50 fps with a 1/50 shutter to avoid flickering lights.",
    checks: [
      { key: "ca-fps", text: "1080p or 4K at 25 fps (50 fps if you want slow-motion B-roll); shutter 1/50", why: "Matches 50 Hz power — no flicker from LED and tube lights." },
      { key: "ca-4k", text: "Shoot 4K if you can, even for a 1080p video", why: "Lets you punch in for zoom-cuts and crop vertical Shorts from the same take." },
      { key: "ca-eye", text: "Lens at eye level, 1–1.5 m from you", why: "Below = unflattering; too close = distorted." },
      { key: "ca-frame", text: "Frame from mid-chest up; eyes about one-third from the top; a little headroom", why: "Standard talking-head framing; leaves room for zoom-cuts." },
      { key: "ca-vertical", text: "Keep important things (face, props) in the centre third so the vertical crop works", why: "One shoot → long video + Shorts." },
      { key: "ca-focus", text: "Face/eye autofocus on, or manual focus locked on your seat position" },
      { key: "ca-white", text: "Set white balance manually to match your lights (don't use auto)", why: "Auto white balance shifts colour mid-take." },
      { key: "ca-backup", text: "Spare battery or dummy battery on mains; card formatted; enough space for 1 hour", why: "Overheating and dead batteries end shoots, especially in Dhaka heat." },
    ],
  },
  {
    id: "audio", title: "Sound", intro: "People forgive average video; they leave for bad audio.",
    checks: [
      { key: "au-close", text: "Mic as close as possible to your mouth but out of frame (lav on chest, or shotgun just above frame)", why: "Closer mic = less room echo and noise." },
      { key: "au-level", text: "Levels peak around −12 dB, never hitting 0 (do a test sentence at your loudest)", why: "Clipped audio can't be fixed." },
      { key: "au-test", text: "Record 10 seconds of silence at the start", why: "Lets noise reduction learn the room tone." },
      { key: "au-headphones", text: "Listen back on headphones after the first take", why: "Catches hum, rustle and echo before you film everything." },
      { key: "au-capcut", text: "In CapCut: Noise reduction (light), Loudness normalisation, a little compression", why: "Clear, even voice." },
    ],
  },
  {
    id: "delivery", title: "You on camera", intro: "Energy reads lower on camera than in person. Script, then deliver it like you're explaining to one friend.",
    checks: [
      { key: "de-prompter", text: "Teleprompter app on a phone/tablet just below the lens (or above), font big, slow scroll", why: "Eyes stay near the lens; you don't need to memorise." },
      { key: "de-lens", text: "Look at the lens on key lines", why: "Eye contact = trust." },
      { key: "de-energy", text: "Deliver slightly more energy than feels natural", why: "Camera flattens energy." },
      { key: "de-wardrobe", text: "Solid colours that contrast with the background; no fine stripes or checks; avoid pure white/black", why: "Patterns flicker on camera; extremes break exposure." },
      { key: "de-batch", text: "Batch-film: 2–3 videos per shoot day in the same outfit only if they'll publish apart, or change tops", why: "Saves setup time." },
    ],
  },
];

export const KIT_UPGRADES: { item: string; why: string; when: string }[] = [
  { item: "Teleprompter (phone app + beam-splitter glass, or a tablet prompter)", why: "Lets you read scripts while looking at the lens — the biggest quality jump for scripted explainers.", when: "Now" },
  { item: "Second light for back/hair light (small LED)", why: "Separation from the background.", when: "Now if you only have one or two lights" },
  { item: "Wireless lav mic set", why: "On-location and walk-and-talk formats; backup for the main mic.", when: "Before on-location videos" },
  { item: "UPS/IPS or a power station for lights", why: "Load-shedding.", when: "Now" },
  { item: "Acoustic treatment: thick curtains, rug, a few foam/fabric panels", why: "Kills echo cheaply.", when: "Now" },
  { item: "Dummy battery / mains adapter for the camera", why: "Long takes without battery swaps or overheating.", when: "When you film long videos weekly" },
  { item: "Fast SSD for footage", why: "4K editing in CapCut needs space and speed.", when: "When the computer's drive fills up" },
];

// ---------------------------------------------------------------------------
// The workflow: idea → upload → review, with checklists
// ---------------------------------------------------------------------------

export const WORKFLOW: GuideSection[] = [
  { id: "validate", title: "1 · Pick & validate the idea", intro: "Before any research: will people click, and do you have an angle nobody else has?", checks: [
    { key: "va-demand", text: "Check demand: YouTube search suggestions for the topic (Title lab shows them) and whether similar videos got views" },
    { key: "va-competitors", text: "Check competitors: who covered it, how many views, what angle they missed (Competitors tab)" },
    { key: "va-angle", text: "Write the one-sentence angle: what will viewers know at the end that they don't now?" },
    { key: "va-package", text: "Write the title and sketch the thumbnail FIRST — if you can't, the idea isn't ready" },
  ] },
  { id: "research", title: "2 · Research", intro: "Use a project: stories, full articles, questions (researcher + viewer), answers with sources.", checks: [
    { key: "re-project", text: "Make it a project from the story/idea" },
    { key: "re-full", text: "Get full articles (Script tab → step 0)" },
    { key: "re-questions", text: "Answer the 5 viewer questions the video must cover" },
    { key: "re-visuals", text: "List the visuals you'll show: documents, maps, charts, footage you can legally use" },
  ] },
  { id: "script", title: "3 · Script", intro: "Hooks → outline → draft in your voice → read it out loud and cut 15%.", checks: [
    { key: "sc-hook", text: "Pick the hook from 5 options; the first line works with the sound off (on-screen text)" },
    { key: "sc-format", text: "Follow the chosen format's structure (set it in the project's YouTube panel)" },
    { key: "sc-length", text: "Long video: 1,300–2,100 words (8–14 min). Read aloud and cut anything you'd skip as a viewer" },
    { key: "sc-broll", text: "Mark ▸ on-screen notes for every 5–10 seconds" },
    { key: "sc-check", text: "Verify every [CHECK] and the ‘Check before recording’ list" },
  ] },
  { id: "shoot", title: "4 · Shoot", intro: "Set checklist done once; then it's 15 minutes to set up.", checks: [
    { key: "sh-set", text: "Set checklist done (lights, white balance, 25 fps, 1/50, mic levels)" },
    { key: "sh-prompter", text: "Script loaded in the teleprompter, split into sections" },
    { key: "sh-sections", text: "Film section by section; redo a line immediately if you stumble (clap to mark it)" },
    { key: "sh-vertical", text: "Film 2–3 lines specifically for Shorts (or keep centre-framed for cropping)" },
    { key: "sh-broll", text: "Capture any desk B-roll (hands on documents, screen recordings) the same day" },
  ] },
  { id: "edit", title: "5 · Edit (CapCut)", intro: "Rough cut → tighten → visuals → captions → sound → export.", checks: [
    { key: "ed-rough", text: "Rough cut: keep the best take of each line, delete stumbles (look for the claps)" },
    { key: "ed-tighten", text: "Tighten: remove every pause at the start of sentences; first 30 seconds as tight as possible" },
    { key: "ed-visuals", text: "Add a visual change every 5–10 seconds (zoom-cut, document, map, text)" },
    { key: "ed-captions", text: "Auto captions with your saved style; fix names and numbers" },
    { key: "ed-audio", text: "Noise reduction, normalise loudness, music low (YouTube Audio Library only)" },
    { key: "ed-export", text: "Export 4K or 1080p, 25 fps, high bitrate; separate 9:16 exports for Shorts" },
  ] },
  { id: "package", title: "6 · Package & upload", intro: "Packaging decides whether anyone watches. Treat it as half the work.", checks: [
    { key: "pk-title", text: "Title passes the Title lab (≤60 characters, clear promise, keyword early)" },
    { key: "pk-thumb", text: "Thumbnail: readable at phone size, ≤4 words, one face/emotion, one focal object; test 2–3 versions with YouTube's ‘Test & compare’" },
    { key: "pk-desc", text: "Description from the builder: 2 hook lines, chapters, sources, links" },
    { key: "pk-chapters", text: "Chapters starting at 0:00 (at least 3)" },
    { key: "pk-endscreen", text: "End screen: best next video + subscribe; 1–2 cards where you mention a past video" },
    { key: "pk-playlist", text: "Add to the right playlist/series" },
    { key: "pk-captions", text: "Upload or check captions (CapCut .srt export)" },
    { key: "pk-ads", text: "Self-certify ad suitability honestly (see Rules)" },
    { key: "pk-schedule", text: "Schedule for when your audience is online (evening Bangladesh time per your Performance data)" },
  ] },
  { id: "promote", title: "7 · Promote", intro: "Your 40K followers on Facebook and Instagram are the fastest route to YouTube watch hours.", checks: [
    { key: "pr-shorts", text: "3–5 Shorts cut from the video, each linking it as ‘Related video’" },
    { key: "pr-fb-ig", text: "Post a teaser on Facebook and Instagram pointing to the full video on YouTube" },
    { key: "pr-community", text: "Community post / story with a poll about the topic" },
    { key: "pr-comment", text: "Pin a comment with a question; reply to comments in the first hour" },
  ] },
  { id: "review", title: "8 · Review at 48 hours and 7 days", intro: "Check YouTube Studio → Analytics for this video and record the numbers in the project's YouTube panel.", checks: [
    { key: "rv-ctr", text: "Record click-through rate (CTR) and impressions" },
    { key: "rv-avd", text: "Record average view duration and the retention graph's biggest drop" },
    { key: "rv-lesson", text: "Write one lesson for the next video" },
  ] },
];

// ---------------------------------------------------------------------------
// Packaging rules, diagnosis, policies
// ---------------------------------------------------------------------------

export const THUMBNAIL_RULES = [
  "Readable at phone size: look at it at 10% zoom",
  "One focal point: your face with a clear emotion, or one object/map — not both crowded",
  "≤4 words, and they add to the title rather than repeat it",
  "High contrast; your accent colour; avoid busy backgrounds",
  "Consistent style across a series so it's recognisable",
  "Make 2–3 versions and use YouTube's Test & compare",
];

export const DIAGNOSIS: { metric: string; low: string; fix: string }[] = [
  { metric: "Click-through rate (CTR)", low: "Below ~3% after the first 48 hours", fix: "Packaging problem: try a new thumbnail first (bigger face/emotion, fewer words), then a clearer title promise." },
  { metric: "First 30 seconds retention", low: "More than ~30% leave in the first 30s", fix: "Hook problem: start with the payoff question or most surprising fact; cut greetings and context from the opening; make the first line match the title." },
  { metric: "Average view duration", low: "Under ~35% of the video length", fix: "Pacing problem: tighten, add a visual change every 5–10s, add open loops (‘more on that in a minute’), remove tangents." },
  { metric: "Big drop mid-video", low: "A cliff in the retention graph", fix: "Look at that exact moment: a slow tangent, a sponsor read in the wrong place, or a promise already paid off too early." },
  { metric: "Views from Browse/Suggested", low: "Mostly from external/Search only", fix: "YouTube isn't recommending it yet: keep a consistent topic per channel, use series/playlists, and link videos to each other with end screens." },
  { metric: "Subscribers per 1,000 views", low: "Under ~2", fix: "Viewers don't see what's next: name the series, promise the next video, put the best next video on the end screen." },
];

export const RULES: { title: string; points: string[] }[] = [
  { title: "Getting monetised (YouTube Partner Program)", points: [
    "Full programme (ads): 1,000 subscribers plus either 4,000 public watch hours in the last 12 months or 10 million public Shorts views in the last 90 days.",
    "Earlier tier (memberships, Super Thanks, shopping): 500 subscribers, 3 public uploads in 90 days, plus 3,000 watch hours in 12 months or 3 million Shorts views in 90 days.",
    "Check YouTube Studio → Earn for the exact current numbers and availability in Bangladesh — YouTube changes them.",
    "Watch hours come from long videos; Shorts views don't count towards the 4,000 hours. That's why the plan below is long-form first, Shorts for discovery.",
  ] },
  { title: "Keeping ads on news and politics videos", points: [
    "Political and news topics are allowed but can get limited ads if the video is graphic, hateful, shocking or uses heavy profanity.",
    "Avoid gore and graphic violence in footage and thumbnails; describe rather than show.",
    "Keep the first 30 seconds and the thumbnail free of profanity, shocking imagery and inflammatory wording.",
    "Neutral, factual wording about sensitive groups and events; no slurs, no calls to harm.",
    "Self-certify honestly when uploading — accurate ratings build trust with YouTube's system.",
  ] },
  { title: "Copyright: footage, music, images", points: [
    "TV news clips and other creators' videos trigger Content ID claims (your ad money goes to them) or strikes. Use them only in short bits with real commentary — or better, quote cards and screenshots of headlines.",
    "Music: only YouTube Audio Library or properly licensed tracks. Never popular songs.",
    "Images: your own, Wikimedia Commons (follow each licence and credit), government/press-release images, or stock sites like Pexels/Pixabay. Credit in the description.",
    "Maps: Google Maps/Earth screenshots are allowed with the attribution kept visible; Wikimedia maps with credit.",
  ] },
  { title: "Reused content (important for multiple channels)", points: [
    "Channels that mostly re-upload or lightly edit other people's content can be refused monetisation. Your own face, voice, script and analysis on every video keeps you safe.",
    "Don't post the same video on two of your channels.",
  ] },
  { title: "Running several channels", points: [
    "Use one Google account with Brand Accounts for each channel, so you can switch and add an editor later without sharing your password.",
    "Each channel needs a clear, single promise. Start new niches as a series on your main channel; spin them out once a series proves itself (several videos well above your usual).",
  ] },
];

export const DESCRIPTION_TEMPLATE = `{hook1}
{hook2}

⏱ Chapters
{chapters}

📚 Sources
{sources}

{cta}

{links}

#{tag1} #{tag2} #{tag3}`;

/** Channel launch checklist. */
export const LAUNCH: { key: string; text: string; why?: string }[] = [
  { key: "brand-account", text: "Create the channel as a Brand Account under your Google account", why: "Lets you run several channels and add an editor later without sharing your password." },
  { key: "verify", text: "Verify the channel with your phone (YouTube Studio → Settings → Channel → Feature eligibility)", why: "Unlocks custom thumbnails, videos over 15 minutes and live streaming." },
  { key: "handle", text: "Claim a short handle that matches your other platforms" },
  { key: "photo", text: "Profile photo: your face, clean background in your accent colour", why: "Shows tiny next to every video and comment — a face builds trust." },
  { key: "banner", text: "Banner (2560×1440; keep text inside the central 1546×423): what the channel is + upload schedule" },
  { key: "about", text: "About: who it's for, what they'll get, how often, business email; include the topic words people search" },
  { key: "links", text: "Links to Instagram, Facebook, TikTok, WhatsApp channel/newsletter" },
  { key: "defaults", text: "Upload defaults: description template, category (Education or News & Politics), language English, captions language" },
  { key: "playlists", text: "3–5 playlists, one per series/pillar" },
  { key: "trailer", text: "A 45–60s channel trailer for non-subscribers: who you are, what you explain, why subscribe" },
  { key: "watermark", text: "Branding watermark (Customisation → Branding) — a subscribe button on every video" },
  { key: "bank", text: "Have 3 long videos finished before announcing the channel", why: "New visitors binge; one video gives them nowhere to go." },
  { key: "announce", text: "Announce to your Facebook and Instagram followers with the best video", why: "Your 40K followers are the fastest start." },
];
