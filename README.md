# Research Desk

A local-first research and news intelligence workspace. It collects real news from RSS feeds, groups coverage of the same development into stories, ranks them by the *editorial characteristics* you care about, and turns any story into a persistent research environment of questions, evidence-backed answers, sources, notes and projects.

Ordinary use — reading, ranking, searching, organising, following connections, re-opening earlier answers, and even searching academic indexes for sources — makes **no AI calls**. AI is used only when you click a purple ✦ button, always shows its cost first when it matters, is cached, and is capped by budgets you set.

---

## Quick start

Requirements: **Node.js 20+** (tested on 24) and npm. No other services.

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

Default budgets: **$2/day, $20/month, $0.50 per task**. Calls that would exceed a limit are refused and logged.

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

**Discover** — Your ranked feed. Each card is a *story* (several outlets' coverage of one development) with the editorial signals detected in it. *Why this?* shows the exact score breakdown. Save, hide, or mark stories *Interesting* — and say **why** (which signals) — and the ranking learns. Filter by signal, region, outlet, coverage breadth and time window. *Assess top 15 with AI* (optional, one batched call) adds signals the phrase cues missed.

**Story workspace** (open any story) — three panes:
- *Left*: coverage timeline with links to every original article, summary, optional AI brief (what it means, how coverage differs, what's unclear), signals, names in the coverage, related stories, projects, connections, notes.
- *Centre*: research questions. Generate a set with AI (optionally steered: “focus on who finances this”), or write your own. Edit, pin, re-status, combine, delete. Expand a question to see its answers, record your own finding, and add follow-ups.
- *Right*: evidence for the selected question, or the research assistant.

**Three research depths**, each a deliberate click:
1. **Quick context** — a short answer grounded in the story's coverage and the sources you attached.
2. **Find sources** (free, no AI) searches your library, OpenAlex, Crossref, Wikipedia and GDELT; results arrive as *candidates* for you to attach or reject. **Explore sources & answer** does this and then answers from what was found.
3. **Deep research** — plans several searches, gathers material, compares evidence and writes a structured brief: findings, competing explanations with evidence for/against, gaps, and editorial angles.

Every answer separates **facts** (must cite a supplied source), **allegations**, **predictions**, **interpretations** and **hypotheses**. Citations are numbered chips linking to the original. Any citation the model invents is removed and the claim is marked *unsourced*; an "established" verdict without surviving evidence is downgraded to *insufficient*. If there is no source material, the app refuses to answer rather than guess.

**Research** — Projects with an editable pipeline (Discovered → Saved → Investigating → Research ready → In production → Published → Archived). A project gathers stories, questions (with their answers), an evidence library, gaps, angles, an outline, notes and its own assistant.

**Library** — Sources with provenance (where each came from, when retrieved, what it supports), saved stories, all notes, and the full article archive. Add sources by hand; nothing is auto-filled.

**Search** — Local full-text search over stories, articles, questions, answers, sources, notes and projects, with filters for date, outlet, source type, research status and project.

**Settings** — Feeds (add/disable/remove/prioritise; failures shown), editorial signals (weights, learned adjustments, your own signals with cue phrases), discovery rules (boost/bury/hide), region weights, AI provider/model/budgets with a usage log, and pipeline stages.

---

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
| Assistant message | 1 | |

Typical costs with Opus 5.5 at medium effort are a few cents per action; Haiku 5.5 is roughly 40× cheaper. Exact token counts and estimated costs are in Settings → AI & usage.

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how it is built
- [docs/DEPLOY-HOSTINGER.md](docs/DEPLOY-HOSTINGER.md) — putting it online
- [docs/STATUS.md](docs/STATUS.md) — what is implemented, partial or deferred, and the next priorities

## Content and sources

The app stores only what publishers put in their public RSS/Atom feeds (headline, link, date, description). It never scrapes article pages or paywalled content; always open the original via the links provided. Research metadata comes from the OpenAlex, Crossref, Wikipedia and GDELT public APIs exactly as returned.
