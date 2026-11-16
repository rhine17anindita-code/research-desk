# Status

What the first version does, what is partial, and what comes next. Section letters refer to §13 of the product specification.

## Implemented

| Spec | Feature | Notes |
|---|---|---|
| A | News ingestion | 28 public RSS/Atom feeds across international, regional (incl. South Asia), investigative, official, research and industry sources; add/disable/remove/prioritise; manual and scheduled refresh; per-feed errors; URL + headline deduplication; cross-outlet story clustering; local storage. |
| B | Personalised discovery | Editorial-signal ranking with visible score breakdown; save / hide / interesting (with reasons) / not for me; learned signal and vocabulary weights; custom signals; boost/bury/hide rules; region and source priorities; filters; optional batched AI assessment. |
| C | Story pages | Coverage timeline with original links, summary, metadata, entities, related stories, optional AI brief including coverage differences and unknowns. |
| D | AI question generation | Story-specific, multi-dimension questions with rationale, answerability and search terms; steerable; duplicates removed; stored permanently; add/edit/delete/pin/re-status/combine; follow-ups. |
| E | Grounded answers | Three depth levels; numbered citations to supplied sources only; claim kinds; invented citations removed and flagged; refuses without material; answer history; your own findings. |
| F | Source library | Provenance-rich sources from feeds, OpenAlex, Crossref, Wikipedia, GDELT or by hand; attach/reject per question; usage view; search and filters. |
| G | Research workspaces | Projects with editable pipeline, thesis, stories, questions with answers, evidence library, gaps, angles, outline, notes. |
| H | Research assistant | Per story / project / question; uses coverage, questions, saved answers, sources and notes; optional extra retrieval; save replies as notes and suggestions as questions. |
| I | Connections | Typed, labelled links between stories, questions, sources and projects; related stories computed locally. |
| J | AI config & cost controls | Server-only keys; provider and model choice; effort; per-task/daily/monthly budgets; cost estimates before running; cache; usage log; works fully with AI off. |
| — | Content ideation | Untold-story finder (local scoring), AI idea batches across 12 formats backed by stories/sources, swipe deck with reasons and undo, saved board (saved → developing → made), develop-to-project, inspiration inbox with oEmbed/OpenGraph/Crossref metadata and local story matching, AI "why it works", taste stats and an editable AI taste summary injected into all prompts. |
| — | Search | Unified local full-text search with filters. |
| — | Tests & docs | 30 tests including an end-to-end research journey; README, architecture, this status page. |

## Partial

- **Entity extraction** is heuristic (capitalised phrases). It links stories well but shows some noise (e.g. "CEO of Nvidia"). A small local NER model would improve related-story discovery.
- **Clustering** is lexical. It merges most differently worded coverage but can split a story whose outlets share few words. Embeddings (local) would help.
- **Coverage differences** are identified only by the optional AI brief; there is no non-AI comparison of outlets yet.
- **Feed list** is a starting set; publishers change URLs. One default feed (Brookings) currently serves malformed XML and ships disabled. GDELT is sometimes unreachable; this is reported per search.
- **Mobile layout** is usable (stacked panes, menu) but the story workspace is designed for desktop.
- **Keyboard shortcuts** are not yet implemented.

## Deferred (by design for the MVP)

- Interactive graph view of the research network (links are stored and listed; visualisation later).
- Multi-user accounts, roles, sharing, assignments, comments, revision history.
- Semantic search / embeddings.
- Source credibility scoring, contradiction alerts, monitoring of ongoing investigations.
- Exporting dossiers (Markdown/PDF) and research-to-script outlines (the assistant can draft an outline into a note today).
- Paid search APIs (e.g. web search) — the retrieval boundary in `research/retrieval.ts` is where they would plug in, behind the same budget controls.

## Next priorities

1. **Export**: one-click Markdown/PDF dossier of a project (questions, answers with numbered references, sources, notes).
2. **Better story matching**: local sentence embeddings (e.g. via `transformers.js`) for clustering and related-story discovery, keeping zero marginal cost.
3. **Full-text for open-access sources**: fetch OA PDFs/HTML for OpenAlex results with an `oa_url` to give answers richer passages (with passage-level citation).
4. **Coverage comparison without AI**: align outlet summaries and highlight differing numbers, names and claims.
5. **Graph view** over the `links` table with progressive expansion and filters.
6. **Batch question generation** for several saved stories via the Message Batches API (50 % cheaper) for overnight runs.
7. **Monitoring**: watch saved stories/questions for new matching coverage and flag updates to an investigation.
8. **Team readiness**: user table, `created_by` on every write, Postgres adapter.
