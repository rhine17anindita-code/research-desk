# Architecture

Research Desk is one Next.js 15 (App Router, TypeScript) application with a SQLite database. No other processes, queues, vector stores or hosted services are required.

```
Browser ──► Next.js server components (read DB directly, render pages; no AI)
        ──► Route handlers  /api/*  (mutations, AI actions, retrieval)
                 │
                 ├─ src/lib/repo/*        typed repositories over SQLite (better-sqlite3)
                 ├─ src/lib/ingest/*      RSS fetch → parse → dedupe → cluster
                 ├─ src/lib/ranking.ts    rule-based scoring + feedback learning
                 ├─ src/lib/research/*    retrieval, AI research tasks, assistant
                 └─ src/lib/ai/*          the single AI gateway (providers, budgets, cache, logs)
```

## Data model

Defined in `src/lib/db/migrations.ts` (append-only, versioned migrations applied automatically on start). Every record has a prefixed text id (`story_…`, `q_…`, `src_…`) and ISO timestamps, which keeps a later move to PostgreSQL mechanical.

| Table | Holds |
|---|---|
| `feeds` | Configured RSS/Atom sources, priority, last status/error |
| `articles` | Ingested items (headline, link, description, publisher, date, entities); unique canonical URL |
| `clusters` | Stories: grouped coverage, headline, summary, entities, regions, user state/rating, cached AI brief/assessment |
| `signals`, `rules`, `term_weights`, `feedback` | Personalisation: editorial signals (user weight + learned weight), explicit rules, learned vocabulary, feedback log |
| `questions` | First-class research questions (dimension, rationale, answer state, priority, origin, parent for follow-ups) |
| `answers` | Answers at level 0 (user finding), 1, 2, 3; structured points with claim kinds; superseded history kept |
| `sources` | Evidence records with provenance (provider, retrieved date, DOI, excerpt) |
| `question_sources` | Candidate / attached / rejected sources per question |
| `evidence` | Which source backs which claim of which answer, and how (supports / contradicts / context) |
| `links` | Typed relationships between any two objects (related_to, follow_up_of, supports, contradicts, resembles, updates, context_for, part_of, derived_from) |
| `projects`, `project_items`, `notes` | Workspaces, their contents, notes (user or saved-from-assistant) |
| `chat_threads`, `chat_messages` | Assistant conversations attached to a story / project / question |
| `ai_requests`, `ai_cache` | Usage log (tokens, estimated cost, status) and reusable AI results |
| `search_index` | One FTS5 table indexing every searchable object, maintained by the repository layer |

Provenance is explicit throughout: `origin` (`ai` / `user` / `assistant`) on questions, answers and notes; `provider` on sources. The UI renders these as badges so sourced material, your work and AI output are never confused.

## Ingestion and clustering (no AI)

`ingest/pipeline.ts`: fetch feeds concurrently (6 at a time, 15 s timeout, per-feed error capture) → `rss.ts` parses RSS 2.0 / Atom / RDF with `rss-parser`, sanitising malformed XML → **deduplication** by canonical URL (tracking parameters, `www.`, AMP and trailing slashes removed) and by headline hash per publisher within 3 days → **clustering** (`cluster.ts`, pure and unit-tested): an article joins the most similar story updated within 72 h when headline tokens overlap strongly, or when they share named entities and vocabulary. Entities are cheap capitalised-phrase extraction. Each touched story's headline (most central), summary, counts, regions and index entry are recomputed.

Scheduled refresh: set `INGEST_INTERVAL_MINUTES`; a timer starts with the first server-side database use. Concurrent refreshes share one run.

## Ranking (no AI)

`ranking.ts` scores each recent story transparently: editorial signals detected by cue phrases (weighted by your setting + learned adjustment, with diminishing returns), breadth of coverage, recency (30 h half-life), feed priority, region preference, learned vocabulary affinity (capped ±4), your explicit rating, and rules (boost / bury / hide). Optional AI assessment adds signal strengths. Feedback (`recordFeedback`) adjusts learned signal weights (strongly when you give reasons) and term weights. The breakdown is shown in the UI.

## AI gateway

All model use goes through `runAiTask` in `ai/service.ts`:

1. **Enabled + configured?** Otherwise a clear, non-throwing failure (`disabled`, `not_configured`) the UI explains.
2. **Cache:** key = hash(task, model, inputs). Identical requests return the stored, re-validated result at zero cost. Regenerate bypasses the lookup deliberately.
3. **Budgets:** worst-case estimate (input chars/4 + full `max_tokens` × list price) checked against per-task, daily and monthly limits before any call.
4. **Structured output:** zod schema → JSON Schema → provider (`output_config.format` for Claude; JSON mode for OpenAI-compatible). The reply is validated; invalid output is discarded, never stored.
5. **Logging:** tokens, estimated cost, duration, status for every attempt (ok / cached / blocked / error).

Providers (`ai/providers.ts`): `AnthropicProvider` (official `@anthropic-ai/sdk`, server-side refusal fallback on Opus/Sonnet 5.5) and `OpenAiCompatibleProvider`. Adding another is one class implementing `AiProvider`. Every AI endpoint also supports `estimateOnly`, which builds the real prompt and returns a cost estimate without calling the model; the `AiButton` component uses it to confirm costs.

## Grounding

`research/ai-tasks.ts` builds **source packs**: numbered excerpts `[S1]…[Sn]` from the story's articles, attached sources and (level 2/3) retrieved candidates. Prompts instruct the model to cite only those labels and to treat excerpts as untrusted data. `validateAnswer` maps labels back to real source ids, drops anything not supplied, flags factual claims left unsupported, and downgrades unsupported "established" verdicts. Evidence rows link each claim to its source. The assistant follows the same rules; its earlier replies are passed as conversation, never as sources, and citations are stored as stable `[[src:id]]` markers.

## Retrieval (no AI)

`research/retrieval.ts` queries OpenAlex (works + reconstructed abstracts), Crossref, Wikipedia (intro extracts, labelled tertiary), GDELT (news headlines) and the local corpus, concurrently, with per-provider error reporting. Results are upserted as sources (deduplicated by URL) and linked to the question as *candidates*. Only metadata the index returns is stored.

## UI

Server components read the database directly and render quickly; interactive pieces are small client components that call `/api/*` and then `router.refresh()`. Tailwind CSS v4 with design tokens in `globals.css` (light and dark themes), Inter for interface text and Source Serif 4 for headlines and questions. The story workspace keeps the selected question in the URL (`?q=`) so returning restores your place.

## Tests

`npm test` runs Vitest against in-memory SQLite: text utilities, clustering, feed parsing and ingestion (fixtures, dedup, failures), ranking and feedback learning, the AI gateway (graceful degradation, caching, budgets, invalid output) and a full research-journey test with a scripted provider and stubbed retrieval (questions → grounded answer with an invented citation removed → cached reuse → source exploration with a failing provider → links → project → assistant → search → merge).

## Moving beyond single-user local

- **PostgreSQL:** the SQL is portable apart from FTS5 (replace with `tsvector`) and `julianday` in one dedup query. Repositories are the only SQL callers.
- **Teams:** add `users`, `workspace_id`/`created_by` columns, and a session layer; links, notes and answers already record origin and timestamps.
- **Hosting:** the scheduler would move to a cron/worker; SQLite to Postgres; secrets to the host's secret store.
