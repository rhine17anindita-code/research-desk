# Research Desk

A local-first research and news intelligence workspace. It collects real news from RSS feeds, groups coverage of the same development into stories, ranks them by the *editorial characteristics* you care about, and turns any story into a persistent research environment of questions, evidence-backed answers, sources, notes and projects.

Ordinary use — reading, ranking, searching, organising, following connections, re-opening earlier answers, and even searching academic indexes for sources — makes **no AI calls**. AI is used only when you click a purple ✦ button, always shows its cost first when it matters, is cached, and is capped by budgets you set.

---

## Quick start

Requirements: **Node.js 22+** (tested on 24) and npm. No other services.

```bash
cd research-desk
npm install
cp .env.example .env.local      # optional: add ANTHROPIC_API_KEY to enable AI features
npm run db:init                 # creates data/research-desk.db with default feeds and signals
npm run ingest                  # fetch the feeds once (or use "Refresh feeds" in the app)
npm run dev                     # http://localhost:3100
```

Open <http://localhost:3100>. If you are offline, *Discover* offers to load a handful of clearly labelled **fictional** sample stories so you can try the workflow; remove them in Settings → Sources.

For a production-style run: `npm run build && npm start` (set `SITE_PASSWORD` first — in production the app stays locked without one, unless you set `ALLOW_OPEN_ACCESS=true`).

**Putting it online:** see [docs/DEPLOY-HOSTINGER.md](docs/DEPLOY-HOSTINGER.md). Any Node.js host with a persistent disk works the same way.

### Enabling AI (optional)

Put your key in `.env.local` and restart the server:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Keys are read on the server only; they never reach the browser and are never written to the database. The default model is **Claude Opus 5.5** (`claude-opus-5-5`). In **Settings → AI & usage** you can switch to Claude Sonnet 5.5 or Haiku 5.5 (much cheaper), set a separate cheaper model for bulk story assessment, change reasoning effort, or point the app at any **OpenAI-compatible endpoint** (Ollama, LM Studio, OpenRouter…) for free local models. Server-side refusal fallback is enabled for Opus/Sonnet 5.5 calls.

Default budgets: **$2/day, $20/month, $0.50 per task**. Throughout the app, AI use is shown as a percentage of these budgets. Calls that would exceed a limit are refused and logged.

### Environment variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Enables Claude-powered features. |
| `OPENAI_COMPAT_BASE_URL`, `OPENAI_COMPAT_API_KEY` | Alternative provider (select it in Settings). |
| `DATABASE_PATH` | Where the SQLite file lives (default `./data/research-desk.db`). |
| `INGEST_INTERVAL_MINUTES` | Refresh feeds automatically while the server runs (≥ 5; default off). |
| `SITE_PASSWORD` | Password protecting the whole site (required in production). |
| `SESSION_SECRET` | Optional separate secret for signing sessions. |
| `ALLOW_OPEN_ACCESS` | `true` to run in production without a password (not recommended). |
| `YOUTUBE_API_KEY` | Optional free YouTube Data API key to show related videos in the app. |
| `OPENALEX_MAILTO` | Optional contact for OpenAlex's faster "polite pool". Left empty, requests are anonymous. |

### Commands

| Command | |
|---|---|
| `npm run dev` | Development server on port 3100 |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Unit and workflow tests (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run db:init` | Create/migrate the database and insert defaults (idempotent) |
| `npm run ingest` | Fetch all enabled feeds once from the command line |
| `npm run seed:sample` | Load the fictional offline sample stories |

---

## Using it

**Channels** — Pick who you are working as from the top of the sidebar (e.g. *Politics & current affairs*, *Books, film & culture*, or any you add in Settings → Channels). Each channel has its own sources, profile, learned taste, ideas, inspirations and projects; the news library underneath is shared.

**Studio** (home) — From spark to project on one page:
- *One box for everything*: paste a link (saved as inspiration, public details read, related stories matched), write your own idea in any format (talking head, interview, podcast, essay…) and **Develop** it — angles, outline, next steps, things to look at, people, risks and a **proposal** for whoever you name — or type a topic to get ideas about it. Results appear right there.
- *Ideas for you*: a deck of ideas built like a content strategist would — title + alternatives, thumbnail concept, the first seconds, the untold angle, why it travels, the research behind it, visuals, and scores for hook, reach, freshness and proof (weak ideas are discarded before you see them). Skip ←, save →, develop ↑. Optional daily batch per channel.
- *Statements radar*: consequential things public figures said, found in the coverage, each with ideas on the spot.
- *Untold stories*, *What people are into right now* (trending searches, Wikipedia most-read, on this day) and *Your inspiration* — each with "Ideas from this" inline.
- *Your pipeline*: your own ideas, saved, in development, made.

**Discover** — The channel's news, ranked by editorial signals, with images. *Why this?* shows the score; feedback teaches the ranking. Topic watches (Google News) and YouTube channels can be followed as sources.

**Story workspace** — Coverage timeline, AI brief, signals, *Visuals, archive & video* (Wikimedia Commons photos, Internet Archive footage/documents, YouTube), related stories, merge, research questions with three depths of grounded answers, evidence, assistant.

**Research** — Projects through an editable pipeline (with stories you're investigating and open questions alongside). Each project has questions, an evidence library, notes, AI angles/outlines in any format, and a printable/Markdown dossier.

**Library**, **Search** (⌘K anywhere) and **Settings** (channels, sources, personalisation, AI & usage, pipeline).

## What costs money

| Action | AI calls | Notes |
|---|---|---|
| Reading, ranking, filtering, feedback, search, notes, projects, connections | 0 | Always free |
| Find sources | 0 | Free public APIs |
| Re-opening any saved answer, brief or question set | 0 | Stored permanently |
| Repeating an identical AI request | 0 | Served from cache (logged as *cached*) |
| Explain this story | 1 | |
| Generate questions | 1 | |
| Quick context / Explore & answer | 1 | |
| Assess top 15 stories | 1 | Batched |
| Deep research | 2 | Plan + brief |
| Generate a batch of ideas | 1 | 5–12 ideas per call; optional once-a-day batch per channel |
| Expand your own idea / write a proposal | 1 each | |
| Why does this inspiration work? | 1 | Uses your bulk model if set |
| Update taste summary | 1 | Only when you click |
| Untold stories, statements radar, trends, visuals/archive search, swipes, inspirations, develop-to-project | 0 | Always free |
| Assistant message | 1 | |

Typical costs with Opus 5.5 at medium effort are a few cents per action; Haiku 5.5 is roughly 40× cheaper. Exact token counts and estimated costs are in Settings → AI & usage.

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how it is built
- [docs/DEPLOY-HOSTINGER.md](docs/DEPLOY-HOSTINGER.md) — putting it online
- [docs/STATUS.md](docs/STATUS.md) — what is implemented, partial or deferred, and the next priorities

## Content and sources

The app stores only what publishers put in their public RSS/Atom feeds (headline, link, date, description). It never scrapes article pages or paywalled content; always open the original via the links provided. Research metadata comes from the OpenAlex, Crossref, Wikipedia and GDELT public APIs exactly as returned.
