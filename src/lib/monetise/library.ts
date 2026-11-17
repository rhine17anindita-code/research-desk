/**
 * The starting library for monetisation — written as a content manager, a Bangladeshi brand
 * manager and a strategist would think about it. Every entry is copied into the creator's own
 * editable storage on first use, so they can change, hide, delete or add to anything. No AI.
 */

export type Goal = "grow" | "earn" | "community" | "authority";
export type PlayKind = "cta" | "followup" | "offer" | "community" | "platform" | "integration" | "collab";

export interface Play {
  key: string;
  kind: PlayKind;
  title: string;
  how: string;
  example: string;
  formats: string[]; // short | video | carousel | podcast | any
  goals: Goal[];
  effort: "low" | "medium" | "high";
  sensitiveOk: boolean; // fine on serious/political topics
}

export const KIND_LABEL: Record<PlayKind, string> = {
  cta: "In-video calls to action",
  followup: "Build on the video (follow-ups)",
  offer: "Your own offers & products",
  community: "Community & owned audience",
  platform: "Platform earnings",
  integration: "Sponsor segments that don't ruin the video",
  collab: "Collaborations",
};

export const GOAL_LABEL: Record<Goal, string> = { grow: "Grow followers", earn: "Earn money", community: "Build community", authority: "Build authority & trust" };

export const PLAYS: Play[] = [
  // ---------- In-video CTAs ----------
  { key: "cta-part2", kind: "cta", title: "“Follow for part 2” cliffhanger", how: "End on an open loop the video genuinely doesn't close (the next step of the story, the other side, what happens next week). Say it in one line, no begging.", example: "“Next: who actually pays for this loan — follow so you don't miss it.”", formats: ["short"], goals: ["grow"], effort: "low", sensitiveOk: true },
  { key: "cta-comment-question", kind: "cta", title: "A comment question people can't resist", how: "Ask something specific and easy to answer with a strong opinion or local knowledge — not “what do you think?”. Pin your own answer to seed it.", example: "“Which district do you think gets the least from the budget? Tell me yours.”", formats: ["short", "video", "carousel"], goals: ["grow", "community"], effort: "low", sensitiveOk: true },
  { key: "cta-save", kind: "cta", title: "Give a reason to save", how: "Put one reusable thing in the piece (a checklist, the 3 numbers to remember, a timeline) and say “save this for when…”. Saves push reach on Instagram.", example: "“Save this — you'll need these three numbers when the next fuel price hike comes.”", formats: ["carousel", "short"], goals: ["grow"], effort: "low", sensitiveOk: true },
  { key: "cta-share-someone", kind: "cta", title: "“Send this to someone who…”", how: "Name a specific person the viewer knows (the uncle who forwards rumours, the friend applying abroad). Shares bring new followers more than likes do.", example: "“Send this to the friend who still thinks remittance is just ‘money from abroad’.”", formats: ["short", "carousel"], goals: ["grow"], effort: "low", sensitiveOk: true },
  { key: "cta-series-hook", kind: "cta", title: "Name the series", how: "Give recurring videos a name and say it at the start and end, so one good episode sends people to the rest.", example: "“This is ‘Bangladesh, Explained’ — episode 4.”", formats: ["short", "video"], goals: ["grow", "authority"], effort: "low", sensitiveOk: true },
  { key: "cta-vote-next", kind: "cta", title: "Let them pick the next topic", how: "Offer two topics in the last line or a poll sticker; make the next video and credit the voters.", example: "“Next week: the Teesta deal or why rice prices jumped? Vote in the comments.”", formats: ["short", "video"], goals: ["community", "grow"], effort: "low", sensitiveOk: true },
  { key: "cta-correct-me", kind: "cta", title: "“Correct me if I'm wrong” (with sources)", how: "Invite experts and locals to add what you missed; reply to the best ones. Builds trust and comments, and gives you follow-up material.", example: "“If you work in garments and this is wrong, tell me — I'll update it.”", formats: ["video", "short"], goals: ["authority", "community"], effort: "low", sensitiveOk: true },
  { key: "cta-newsletter", kind: "cta", title: "Point to your owned list", how: "A one-line pointer to your newsletter/WhatsApp channel for the ‘full version’ (sources, charts). Owned audiences survive algorithm changes.", example: "“Sources and the full chart are in my WhatsApp channel — link in bio.”", formats: ["short", "video", "carousel"], goals: ["community", "earn"], effort: "medium", sensitiveOk: true },

  // ---------- Follow-ups ----------
  { key: "fu-tracker", kind: "followup", title: "Turn it into a public tracker or dashboard", how: "If the story has numbers that keep changing (prices, court cases, promises, deaths, loans), keep a simple public tracker (a Google Sheet or a page) and update it. Come back to it in videos.", example: "“The Promise Tracker: every reform the government announced, and whether it happened.”", formats: ["any"], goals: ["authority", "community", "grow"], effort: "high", sensitiveOk: true },
  { key: "fu-guide", kind: "followup", title: "A free guide or explainer PDF", how: "Turn the research into a 3–10 page guide (key facts, timeline, glossary, sources). Give it free for an email/WhatsApp sign-up, or later sell a deeper version.", example: "“Budget 2026, explained in 10 pages — free download.”", formats: ["any"], goals: ["community", "authority", "earn"], effort: "medium", sensitiveOk: true },
  { key: "fu-part2-other-side", kind: "followup", title: "Part 2: the other side / the people affected", how: "Follow a policy video with the human side: interview someone affected, or the strongest counter-argument.", example: "“I explained the new tax. Now I asked three shop owners what it means for them.”", formats: ["short", "video"], goals: ["grow", "authority"], effort: "medium", sensitiveOk: true },
  { key: "fu-live-qa", kind: "followup", title: "A live Q&A on the topic", how: "Go live 2–3 days after a video that got lots of questions; answer the top comments. Lives build loyalty and surface new ideas.", example: "“You had 200 questions about the extradition treaty — I'm answering them live Friday 9pm.”", formats: ["any"], goals: ["community"], effort: "low", sensitiveOk: true },
  { key: "fu-carousel-recap", kind: "followup", title: "Carousel recap for Instagram/Facebook", how: "Turn the script into 6–8 slides with the key numbers. Different audience, same research, more saves.", example: "“Hasina's extradition in 7 slides.”", formats: ["carousel"], goals: ["grow"], effort: "low", sensitiveOk: true },
  { key: "fu-quiz", kind: "followup", title: "A quiz or ‘test yourself’ post", how: "5 questions from the video; answers in the next post or video. Great for evergreen and history topics.", example: "“5 questions about the Liberation War most people get wrong.”", formats: ["carousel", "short"], goals: ["grow", "community"], effort: "low", sensitiveOk: false },
  { key: "fu-update", kind: "followup", title: "“Update:” video when the story moves", how: "Set yourself a reminder for every story with a next step (court date, deadline, vote). The update video reaches people who saw the first.", example: "“Update on the Teesta deal — here's what changed since my last video.”", formats: ["short"], goals: ["grow", "authority"], effort: "low", sensitiveOk: true },

  // ---------- Own offers ----------
  { key: "of-workshop", kind: "offer", title: "Workshops for students & young professionals", how: "Paid or sponsored sessions: ‘how to read the news’, media literacy, explaining policy, making explainer content. Universities, clubs and NGOs pay for these.", example: "“News literacy for first-year students — a 90-minute workshop.”", formats: ["any"], goals: ["earn", "authority"], effort: "medium", sensitiveOk: true },
  { key: "of-speaking", kind: "offer", title: "Speaking, hosting and moderating", how: "Your videos are your showreel. Pitch to conferences, embassies, NGOs and brand events as a host/moderator who makes complex topics clear.", example: "“Moderator for a youth policy dialogue.”", formats: ["any"], goals: ["earn", "authority"], effort: "medium", sensitiveOk: true },
  { key: "of-briefs", kind: "offer", title: "Paid research briefs / explainers for organisations", how: "NGOs, startups and agencies need clear explainers. Offer short commissioned explainers (clearly labelled as commissioned) or internal briefings.", example: "“A 3-minute explainer on a new policy for an NGO's campaign — disclosed.”", formats: ["video"], goals: ["earn"], effort: "high", sensitiveOk: true },
  { key: "of-membership", kind: "offer", title: "Memberships / supporter tier", how: "When eligible: YouTube channel memberships or Facebook subscriptions with a small perk (early access, monthly members' Q&A, sources). Keep the main videos free.", example: "“Members get the sources doc and a monthly live.”", formats: ["video"], goals: ["earn", "community"], effort: "medium", sensitiveOk: true },
  { key: "of-course", kind: "offer", title: "A short course", how: "Later stage: package your method (research, scripting explainers, news literacy) into a short course with an edtech partner or on your own.", example: "“Make explainer videos people trust — 5 lessons.”", formats: ["any"], goals: ["earn", "authority"], effort: "high", sensitiveOk: true },

  // ---------- Community ----------
  { key: "cm-whatsapp", kind: "community", title: "WhatsApp channel or Facebook group", how: "One place you own: post sources, polls, behind-the-scenes and early ideas. Mention it in videos where it's genuinely useful (sources, charts).", example: "“Join the channel for sources and the questions I didn't have time for.”", formats: ["any"], goals: ["community", "earn"], effort: "low", sensitiveOk: true },
  { key: "cm-newsletter", kind: "community", title: "A weekly newsletter", how: "‘The week in Bangladesh in 5 minutes’ — reuses your research. Later a sponsor slot in the newsletter is easy to sell.", example: "“5 things that happened this week, and the one that matters.”", formats: ["any"], goals: ["community", "earn", "authority"], effort: "medium", sensitiveOk: true },
  { key: "cm-ugc", kind: "community", title: "Ask followers to send their story", how: "Invite viewers to send how a topic affects them (with consent). Feature them; they share it.", example: "“Students: send me how the exam delay affected you — I'll feature some.”", formats: ["short", "video"], goals: ["community", "grow"], effort: "low", sensitiveOk: true },

  // ---------- Platform earnings ----------
  { key: "pl-ypp", kind: "platform", title: "YouTube Partner Program", how: "Ad revenue and Shorts revenue sharing once eligible (check the current thresholds in YouTube Studio → Earn). Longer videos earn far more than Shorts — a monthly long video helps.", example: "Track progress in Studio → Earn.", formats: ["video", "short"], goals: ["earn"], effort: "low", sensitiveOk: true },
  { key: "pl-fb", kind: "platform", title: "Facebook content monetisation", how: "Check Professional Dashboard → Monetisation for what your Page is eligible for in Bangladesh (in-stream ads, subscriptions, bonuses change often).", example: "Professional Dashboard → Monetisation.", formats: ["video", "short"], goals: ["earn"], effort: "low", sensitiveOk: true },
  { key: "pl-tiktok", kind: "platform", title: "TikTok earnings", how: "TikTok's creator payouts aren't available in every country; check what's offered in Bangladesh in TikTok Studio. Use TikTok mainly for growth if not.", example: "TikTok Studio → Monetisation.", formats: ["short"], goals: ["earn", "grow"], effort: "low", sensitiveOk: true },

  // ---------- Sponsor integrations ----------
  { key: "in-short-bookend", kind: "integration", title: "Shorts: 3-second ‘supported by’ bookend", how: "Don't touch the hook. After the payoff, one line + logo card: “This explainer was supported by X.” Under 3 seconds; never before second 3.", example: "End card: “Bangladesh, Explained — supported by [brand]”, logo bottom-right.", formats: ["short"], goals: ["earn"], effort: "low", sensitiveOk: false },
  { key: "in-short-prop", kind: "integration", title: "Shorts: product as a natural prop", how: "Only when the product genuinely belongs in the story (a payment app in a remittance video, a phone in a data-price video). No spoken pitch; disclose in caption + platform tag.", example: "Showing a bKash/Nagad screen while explaining transfer fees — with “Paid partnership” tag.", formats: ["short"], goals: ["earn"], effort: "low", sensitiveOk: false },
  { key: "in-short-series-title", kind: "integration", title: "Shorts: series title-card sponsor", how: "Sell the whole series, not one video: a 1-second branded title card on every episode (“Money Minutes, with [brand]”) + mention in captions. The brand gets repetition, viewers lose no time.", example: "“Money Minutes with [bank]” — 8 episodes.", formats: ["short"], goals: ["earn"], effort: "medium", sensitiveOk: false },
  { key: "in-long-midroll", kind: "integration", title: "Long video: 45–60s segment after the first value beat", how: "Place it after you've delivered the first real payoff (2–3 minutes in), never in the cold open. Bridge from the topic (“speaking of moving money…”), say why you actually use it, one clear offer/code, then straight back.", example: "Remittance explainer → 45s on a mobile wallet's fee-free transfers, with a code.", formats: ["video"], goals: ["earn"], effort: "medium", sensitiveOk: false },
  { key: "in-lower-third", kind: "integration", title: "Lower-third ‘supported by’ for the first 5 seconds", how: "Small on-screen text while you speak the hook — no spoken pitch. Works for longer videos and carousels (first or last slide).", example: "“Supported by [brand]” lower-third, bottom-left, 5s.", formats: ["video", "carousel"], goals: ["earn"], effort: "low", sensitiveOk: false },
  { key: "in-dedicated", kind: "integration", title: "Dedicated video that's still useful", how: "Only for brands whose product IS the topic (a student bank account explainer, how mobile banking fees work). It must stand on its own as useful content; full disclosure.", example: "“How to open your first bank account at 18 — with [bank]”.", formats: ["video", "short"], goals: ["earn"], effort: "high", sensitiveOk: false },
  { key: "in-csr", kind: "integration", title: "CSR / development partner support", how: "For serious public-interest series (climate, education, health, civic literacy), approach CSR teams and development partners rather than product marketing. They care about reach among youth and credibility, and accept sensitive topics more.", example: "“Climate Bangladesh” series supported by a CSR programme.", formats: ["video", "short", "carousel"], goals: ["earn", "authority"], effort: "medium", sensitiveOk: true },
  { key: "in-affiliate", kind: "integration", title: "Affiliate links & codes", how: "Books, courses, gadgets and tools you actually used for a video — links/codes in the description. Low effort, never interrupts the video.", example: "The books behind a history video — link to a local bookshop with a code.", formats: ["video", "carousel"], goals: ["earn"], effort: "low", sensitiveOk: true },

  // ---------- Collaborations ----------
  { key: "co-duet", kind: "collab", title: "Collab with a creator from another niche", how: "Pair with a finance, education or comedy creator on a topic you both cover; each posts a version. Cross-audience growth.", example: "A finance creator + you on ‘what the budget means for your salary’.", formats: ["short", "video"], goals: ["grow"], effort: "medium", sensitiveOk: true },
  { key: "co-expert", kind: "collab", title: "Expert guest / interview", how: "Invite an academic, economist or journalist for a short interview. They share it; you gain authority.", example: "“An economist answers your 5 questions about inflation.”", formats: ["video", "podcast"], goals: ["authority", "grow"], effort: "medium", sensitiveOk: true },
  { key: "co-media", kind: "collab", title: "Partner with a media outlet", how: "Offer explainer versions of their reporting for their social channels, credited both ways.", example: "A co-branded explainer series with a newspaper.", formats: ["video", "short"], goals: ["authority", "earn"], effort: "high", sensitiveOk: true },
];

// ---------------------------------------------------------------------------
// Bangladeshi sponsors (a starting list — names are suggestions, not relationships)
// ---------------------------------------------------------------------------

export interface SponsorSeed { name: string; category: string; fits: string[]; notes: string }

export const SPONSOR_CATEGORIES: Record<string, { label: string; topics: string[]; angle: string }> = {
  mfs: { label: "Mobile financial services", topics: ["money", "remittance", "economy", "youth"], angle: "Money moves, remittances, fees, saving — natural in any money explainer." },
  bank: { label: "Banks", topics: ["money", "economy", "youth", "education"], angle: "Student/first accounts, saving, financial literacy series." },
  telecom: { label: "Telecom & internet", topics: ["tech", "youth", "education", "culture", "gaming"], angle: "Data, digital life, youth programmes; big youth marketing budgets." },
  edtech: { label: "Edtech & education", topics: ["education", "youth", "history", "career"], angle: "Students and exam-age audience; explainers are their language." },
  ecommerce: { label: "E-commerce & delivery", topics: ["money", "culture", "youth", "food"], angle: "Prices, shopping, everyday life; seasonal campaigns (Eid, 11.11)." },
  devices: { label: "Phones & electronics", topics: ["tech", "youth", "gaming"], angle: "Tech explainers, ‘how I make my videos’, launches." },
  fmcg: { label: "Food & consumer goods", topics: ["culture", "food", "history", "youth"], angle: "Positive, evergreen and culture content only; very brand-safety minded." },
  ott: { label: "Streaming & media", topics: ["culture", "history", "film", "youth", "gaming"], angle: "History, culture and storytelling content; series tie-ins." },
  travel: { label: "Travel & airlines", topics: ["travel", "history", "culture", "geography"], angle: "Places, history of a city, ‘Bangladesh you don't know’." },
  books: { label: "Books & learning", topics: ["history", "education", "culture"], angle: "Books behind a video, reading lists — affiliate-friendly." },
  lifestyle: { label: "Lifestyle & fashion (local)", topics: ["culture", "history", "craft"], angle: "Heritage, craft, culture stories (e.g. muslin, jamdani)." },
  health: { label: "Health", topics: ["health", "youth"], angle: "Health literacy content; careful with claims." },
  insurance: { label: "Insurance & fintech", topics: ["money", "economy"], angle: "Planning, risk, financial literacy." },
  csr: { label: "CSR & development partners", topics: ["climate", "education", "health", "civic", "rights", "politics"], angle: "Public-interest series; accept serious topics; care about youth reach and credibility." },
  energy: { label: "Energy & sustainability", topics: ["climate", "economy"], angle: "Climate and energy explainers." },
};

export const SPONSORS: SponsorSeed[] = [
  { name: "bKash", category: "mfs", fits: ["money", "remittance"], notes: "Largest MFS; financial-literacy and youth campaigns." },
  { name: "Nagad", category: "mfs", fits: ["money", "remittance"], notes: "Aggressive marketing; remittance angle." },
  { name: "Rocket (Dutch-Bangla Bank)", category: "mfs", fits: ["money"], notes: "Bank-backed MFS." },
  { name: "upay", category: "mfs", fits: ["money"], notes: "UCB-backed; growing." },
  { name: "BRAC Bank", category: "bank", fits: ["money", "youth"], notes: "SME and youth banking; values-led brand." },
  { name: "City Bank", category: "bank", fits: ["money", "youth"], notes: "Cards, digital banking (Citytouch)." },
  { name: "Eastern Bank (EBL)", category: "bank", fits: ["money"], notes: "Digital-first campaigns." },
  { name: "Prime Bank", category: "bank", fits: ["money", "youth"], notes: "Student/youth products." },
  { name: "Standard Chartered Bangladesh", category: "bank", fits: ["money", "economy"], notes: "International; brand-safety strict." },
  { name: "Grameenphone", category: "telecom", fits: ["tech", "youth", "education"], notes: "Biggest telecom marketing budget; youth & digital programmes." },
  { name: "Robi / Airtel", category: "telecom", fits: ["tech", "youth"], notes: "Youth-focused (Airtel brand)." },
  { name: "Banglalink", category: "telecom", fits: ["tech", "youth"], notes: "Digital services (Toffee)." },
  { name: "10 Minute School", category: "edtech", fits: ["education", "youth"], notes: "Huge student audience; creator-friendly." },
  { name: "Shikho", category: "edtech", fits: ["education", "youth"], notes: "Exam-prep edtech." },
  { name: "Daraz", category: "ecommerce", fits: ["money", "culture", "youth"], notes: "Campaign-driven (11.11, Eid)." },
  { name: "Chaldal", category: "ecommerce", fits: ["food", "money"], notes: "Groceries — price explainers." },
  { name: "Pathao", category: "ecommerce", fits: ["youth", "food", "tech"], notes: "Rides/food; youth audience." },
  { name: "foodpanda", category: "ecommerce", fits: ["food", "youth"], notes: "Food delivery; campaign-driven." },
  { name: "Rokomari", category: "books", fits: ["history", "education", "culture"], notes: "Books — affiliate-friendly." },
  { name: "Walton", category: "devices", fits: ["tech"], notes: "Local electronics; ‘made in Bangladesh’ angle." },
  { name: "Samsung Bangladesh", category: "devices", fits: ["tech", "youth"], notes: "Launch campaigns." },
  { name: "Xiaomi / realme Bangladesh", category: "devices", fits: ["tech", "youth"], notes: "Youth phones; creator campaigns." },
  { name: "PRAN-RFL", category: "fmcg", fits: ["food", "culture"], notes: "Large local FMCG; brand-safety minded." },
  { name: "ACI", category: "fmcg", fits: ["food", "health"], notes: "Consumer brands." },
  { name: "Unilever Bangladesh", category: "fmcg", fits: ["culture", "youth"], notes: "Strict brand safety; purpose campaigns." },
  { name: "Square Group", category: "fmcg", fits: ["health", "food"], notes: "Consumer and pharma." },
  { name: "Chorki", category: "ott", fits: ["culture", "film", "history"], notes: "Local OTT; story tie-ins." },
  { name: "Toffee", category: "ott", fits: ["culture", "youth"], notes: "Banglalink's streaming app." },
  { name: "Hoichoi", category: "ott", fits: ["culture", "film"], notes: "Bengali streaming." },
  { name: "US-Bangla Airlines", category: "travel", fits: ["travel", "culture"], notes: "Domestic/regional travel." },
  { name: "ShareTrip", category: "travel", fits: ["travel"], notes: "Online travel agency." },
  { name: "GoZayaan", category: "travel", fits: ["travel", "youth"], notes: "Youth travel brand." },
  { name: "Aarong", category: "lifestyle", fits: ["culture", "craft", "history"], notes: "Heritage and craft stories (BRAC)." },
  { name: "Yellow / Sailor / Richman (local fashion)", category: "lifestyle", fits: ["culture", "youth"], notes: "Youth fashion; seasonal." },
  { name: "Praava Health", category: "health", fits: ["health"], notes: "Health literacy." },
  { name: "MetLife Bangladesh", category: "insurance", fits: ["money"], notes: "Financial planning content." },
  { name: "Guardian Life", category: "insurance", fits: ["money"], notes: "Insurance literacy." },
  { name: "BRAC (programmes)", category: "csr", fits: ["education", "climate", "health", "rights"], notes: "Development programmes; public-interest content." },
  { name: "UNDP / UNICEF Bangladesh", category: "csr", fits: ["climate", "civic", "youth", "rights"], notes: "Youth & civic campaigns; formal proposals." },
  { name: "British Council Bangladesh", category: "csr", fits: ["education", "culture", "youth"], notes: "Education/culture; youth." },
  { name: "Embassy cultural & public-diplomacy funds", category: "csr", fits: ["culture", "civic", "rights", "education"], notes: "Small grants for media literacy, culture, civic content." },
  { name: "Grameenphone / Unilever sustainability (CSR arms)", category: "csr", fits: ["climate", "education"], notes: "Separate from product marketing — pitch to CSR teams." },
  { name: "IDCOL / solar & clean-energy companies", category: "energy", fits: ["climate", "economy"], notes: "Clean energy explainers." },
];

/** Categories most brands won't touch, or the creator may want to avoid. */
export const DEFAULT_AVOID = ["Political parties & candidates", "Betting & gambling", "Crypto trading & get-rich schemes", "MLM / network marketing", "Skin-whitening products", "Tobacco & vaping", "Unlicensed loan apps"];

// ---------------------------------------------------------------------------
// Series made to be sponsored
// ---------------------------------------------------------------------------

export interface SeriesSeed { key: string; name: string; premise: string; episodes: string[]; categories: string[]; format: string; integration: string; sentiment: string }

export const SERIES: SeriesSeed[] = [
  { key: "money-minutes", name: "Money Minutes", premise: "60-second explainers on the money questions young Bangladeshis actually have.", episodes: ["Where does your remittance fee go?", "Why is the taka losing value?", "What is a credit score and does Bangladesh have one?", "Is a DPS worth it?"], categories: ["mfs", "bank", "insurance"], format: "Shorts, weekly", integration: "1s title card “Money Minutes, with [brand]” + caption mention; one dedicated episode per season.", sentiment: "Neutral/positive, evergreen" },
  { key: "bd-you-dont-know", name: "The Bangladesh You Don't Know", premise: "Surprising history and places: the story behind a name, a building, a dish, a river.", episodes: ["Why is it called Dhaka?", "The muslin myth about cut thumbs", "The forgotten railway to Assam", "The real story of Panam City"], categories: ["travel", "ott", "lifestyle", "fmcg"], format: "Shorts + monthly long video", integration: "Supported-by end card; travel partner for on-location episodes.", sentiment: "Positive, evergreen" },
  { key: "explained-in-5", name: "Explained in 5 Slides", premise: "Carousels that explain one big news topic in five slides with sources.", episodes: ["The budget in 5 slides", "The extradition treaty in 5 slides", "The Teesta deal in 5 slides"], categories: ["edtech", "telecom", "csr"], format: "Instagram/Facebook carousels", integration: "First-slide ‘supported by’ line; last-slide offer.", sentiment: "Neutral" },
  { key: "exam-to-career", name: "From Exam to Career", premise: "What happens after HSC/university — jobs, skills, studying abroad, salaries, explained honestly.", episodes: ["What do BCS jobs actually pay?", "Studying abroad: the real costs", "Which skills employers can't find"], categories: ["edtech", "bank", "telecom"], format: "Shorts series + one long video", integration: "Edtech/bank as series partner; dedicated ‘first bank account’ episode.", sentiment: "Positive, evergreen" },
  { key: "tech-and-you", name: "Tech & You", premise: "How tech changes everyday life in Bangladesh: data prices, AI, scams, digital rights.", episodes: ["Why is mobile data so expensive?", "How online scams target students", "Is your phone listening to you?"], categories: ["telecom", "devices", "mfs"], format: "Shorts", integration: "Prop placement (phone/app) + supported-by end card; scam-safety episode with an MFS brand.", sentiment: "Neutral/positive" },
  { key: "climate-bd", name: "Climate Bangladesh", premise: "What climate change actually looks like here, district by district — and who's fixing what.", episodes: ["Why Dhaka floods every monsoon", "The salt in Satkhira's water", "Who is building Bangladesh's solar?"], categories: ["csr", "energy"], format: "Shorts + documentary-style long video", integration: "CSR/development partner support line; no product placement.", sentiment: "Serious but constructive" },
  { key: "history-minutes", name: "History in a Minute", premise: "One surprising moment from Bengal's history, every week.", episodes: ["The day Dhaka got electricity", "The language movement's forgotten women", "When Bengal was the richest place on earth"], categories: ["ott", "books", "lifestyle"], format: "Shorts weekly", integration: "Books affiliate + series title card.", sentiment: "Positive, evergreen" },
  { key: "price-check", name: "Price Check", premise: "Why things cost what they cost: rice, onions, fuel, phones, rent.", episodes: ["Why onion prices jump every year", "Who sets the fuel price?", "Why rent in Dhaka keeps rising"], categories: ["ecommerce", "bank", "mfs"], format: "Shorts", integration: "Grocery/e-commerce partner end card; never let them shape the conclusions.", sentiment: "Neutral" },
  { key: "world-and-bd", name: "The World & Bangladesh", premise: "A global story, and exactly what it means for Bangladesh.", episodes: ["What a US tariff means for our garments", "Why Gulf jobs matter to every district", "China, India and us"], categories: ["bank", "telecom", "csr"], format: "Shorts + long", integration: "Supported-by line only (topics can be sensitive); bank or telecom with a ‘global Bangladesh’ campaign.", sentiment: "Neutral" },
];

// ---------------------------------------------------------------------------
// Rate card defaults (starting points to adjust — not market data)
// ---------------------------------------------------------------------------

export interface RateSettings {
  currency: "BDT";
  perThousandViews: { short: [number, number]; video: [number, number]; carousel: [number, number] };
  minimum: { short: number; video: number; carousel: number };
  dedicatedMultiplier: number;
  seriesDiscount: number;
  crossPost: number;
  usageRightsPerMonth: number;
  exclusivity: number;
}

export const DEFAULT_RATES: RateSettings = {
  currency: "BDT",
  perThousandViews: { short: [400, 900], video: [700, 1500], carousel: [300, 700] },
  minimum: { short: 8000, video: 20000, carousel: 6000 },
  dedicatedMultiplier: 2.5,
  seriesDiscount: 0.15,
  crossPost: 0.3,
  usageRightsPerMonth: 0.2,
  exclusivity: 0.25,
};
