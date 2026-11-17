/**
 * Ordered, append-only schema migrations. Never edit a migration that has shipped;
 * add a new one instead. Each runs inside a transaction and is recorded in
 * `schema_migrations`.
 *
 * Conventions
 *  - Every object has a TEXT primary key (prefixed random id, see lib/ids.ts)
 *    plus created_at / updated_at ISO timestamps. This keeps a later move to
 *    PostgreSQL (uuid/text keys, timestamptz) mechanical.
 *  - `origin` columns record provenance: 'external' (feeds, APIs), 'user',
 *    or 'ai'. The UI uses them to separate sourced material from AI output.
 *  - JSON is stored as TEXT and parsed in the repository layer.
 */
export const migrations: { id: number; name: string; sql: string }[] = [
  {
    id: 1,
    name: "core",
    sql: `
CREATE TABLE feeds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  site_url TEXT,
  region TEXT,
  language TEXT DEFAULT 'en',
  category TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority REAL NOT NULL DEFAULT 1,
  last_fetched_at TEXT,
  last_status TEXT,
  last_error TEXT,
  last_item_count INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE clusters (
  id TEXT PRIMARY KEY,
  headline TEXT NOT NULL,
  summary TEXT,
  first_seen_at TEXT NOT NULL,
  last_updated_at TEXT NOT NULL,
  article_count INTEGER NOT NULL DEFAULT 0,
  source_count INTEGER NOT NULL DEFAULT 0,
  tokens TEXT NOT NULL DEFAULT '[]',
  entities TEXT NOT NULL DEFAULT '[]',
  regions TEXT NOT NULL DEFAULT '[]',
  state TEXT NOT NULL DEFAULT 'new',          -- new | saved | dismissed
  rating INTEGER NOT NULL DEFAULT 0,          -- -1, 0, 1
  ai_brief TEXT,                              -- JSON, AI generated, cached
  ai_assessment TEXT,                         -- JSON, AI editorial signal assessment
  last_viewed_at TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_clusters_updated ON clusters(last_updated_at);
CREATE INDEX idx_clusters_state ON clusters(state);

CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  feed_id TEXT REFERENCES feeds(id) ON DELETE SET NULL,
  cluster_id TEXT REFERENCES clusters(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  canonical_url TEXT NOT NULL UNIQUE,
  guid TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  author TEXT,
  publisher TEXT,
  published_at TEXT,
  fetched_at TEXT NOT NULL,
  language TEXT,
  region TEXT,
  image_url TEXT,
  title_hash TEXT NOT NULL,
  entities TEXT NOT NULL DEFAULT '[]',
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_articles_cluster ON articles(cluster_id);
CREATE INDEX idx_articles_published ON articles(published_at);
CREATE INDEX idx_articles_title_hash ON articles(title_hash);

CREATE TABLE signals (
  id TEXT PRIMARY KEY,                        -- slug
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  cues TEXT NOT NULL DEFAULT '[]',            -- JSON array of phrases / regex sources
  weight REAL NOT NULL DEFAULT 1,             -- user-set preference
  learned REAL NOT NULL DEFAULT 0,            -- adjusted by feedback
  enabled INTEGER NOT NULL DEFAULT 1,
  builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  action TEXT NOT NULL,                       -- boost | bury | hide
  field TEXT NOT NULL DEFAULT 'any',          -- any | title | publisher | region
  pattern TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 2,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE term_weights (
  term TEXT PRIMARY KEY,
  weight REAL NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  cluster_id TEXT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                         -- interesting | uninteresting | save | dismiss | restore
  reasons TEXT NOT NULL DEFAULT '[]',         -- signal ids
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  thesis TEXT,
  description TEXT,
  stage TEXT NOT NULL DEFAULT 'investigating',
  angles TEXT,
  gaps TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE project_items (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,                    -- cluster | question | source | note
  item_id TEXT NOT NULL,
  note TEXT,
  added_at TEXT NOT NULL,
  PRIMARY KEY (project_id, item_type, item_id)
);

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  cluster_id TEXT REFERENCES clusters(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  parent_id TEXT REFERENCES questions(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  dimension TEXT,
  rationale TEXT,
  answer_state TEXT NOT NULL DEFAULT 'unexamined',
  priority INTEGER NOT NULL DEFAULT 2,        -- 1 high, 2 normal, 3 low
  search_terms TEXT NOT NULL DEFAULT '[]',
  origin TEXT NOT NULL,                       -- ai | user | assistant
  followed INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  position REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_questions_cluster ON questions(cluster_id);
CREATE INDEX idx_questions_project ON questions(project_id);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'other',         -- news | paper | report | government | statistics | law | archive | commentary | primary | reference | other
  title TEXT NOT NULL,
  authors TEXT,
  publisher TEXT,
  published_at TEXT,
  url TEXT,
  doi TEXT,
  excerpt TEXT,                               -- abstract / description / supporting passage
  retrieved_at TEXT NOT NULL,
  provider TEXT NOT NULL,                     -- feed | openalex | crossref | wikipedia | gdelt | user
  article_id TEXT REFERENCES articles(id) ON DELETE SET NULL,
  notes TEXT,
  saved INTEGER NOT NULL DEFAULT 0,           -- in the user's library
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_sources_url ON sources(url) WHERE url IS NOT NULL;
CREATE INDEX idx_sources_article ON sources(article_id);

-- A source surfaced for (or attached to) a question. status: candidate | attached | rejected
CREATE TABLE question_sources (
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'candidate',
  found_by TEXT,                              -- e.g. 'openalex:"query"'
  created_at TEXT NOT NULL,
  PRIMARY KEY (question_id, source_id)
);

CREATE TABLE answers (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,           -- 1 quick context, 2 source exploration, 3 deep research
  state TEXT NOT NULL,                        -- established | partial | contested | insufficient | user
  summary TEXT NOT NULL,
  points TEXT NOT NULL DEFAULT '[]',          -- JSON AnswerPoint[]
  caveats TEXT NOT NULL DEFAULT '[]',
  next_steps TEXT NOT NULL DEFAULT '[]',
  brief TEXT,                                 -- JSON (deep research structured brief)
  origin TEXT NOT NULL,                       -- ai | user
  model TEXT,
  ai_request_id TEXT,
  superseded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_answers_question ON answers(question_id);

-- Which source backs which claim of an answer.
CREATE TABLE evidence (
  id TEXT PRIMARY KEY,
  answer_id TEXT NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  claim TEXT NOT NULL,
  passage TEXT,
  relation TEXT NOT NULL DEFAULT 'supports',  -- supports | contradicts | context
  created_at TEXT NOT NULL
);
CREATE INDEX idx_evidence_answer ON evidence(answer_id);
CREATE INDEX idx_evidence_source ON evidence(source_id);

-- Typed relationships between any two research objects.
CREATE TABLE links (
  id TEXT PRIMARY KEY,
  from_type TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_type TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  note TEXT,
  origin TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  UNIQUE (from_type, from_id, to_type, to_id, relation)
);
CREATE INDEX idx_links_from ON links(from_type, from_id);
CREATE INDEX idx_links_to ON links(to_type, to_id);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  cluster_id TEXT REFERENCES clusters(id) ON DELETE SET NULL,
  question_id TEXT REFERENCES questions(id) ON DELETE SET NULL,
  title TEXT,
  body TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'user',        -- user | assistant
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE chat_threads (
  id TEXT PRIMARY KEY,
  context_type TEXT NOT NULL,                 -- cluster | project | question
  context_id TEXT NOT NULL,
  title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_chat_context ON chat_threads(context_type, context_id);

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                         -- user | assistant
  content TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',            -- JSON: cited sources, suggested questions
  ai_request_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE ai_requests (
  id TEXT PRIMARY KEY,
  task TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL,                       -- ok | cached | error | blocked
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error TEXT,
  cache_key TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_ai_requests_created ON ai_requests(created_at);

CREATE TABLE ai_cache (
  key TEXT PRIMARY KEY,
  task TEXT NOT NULL,
  model TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE ingest_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  feeds_ok INTEGER NOT NULL DEFAULT 0,
  feeds_failed INTEGER NOT NULL DEFAULT 0,
  articles_new INTEGER NOT NULL DEFAULT 0,
  articles_duplicate INTEGER NOT NULL DEFAULT 0,
  clusters_new INTEGER NOT NULL DEFAULT 0,
  trigger TEXT NOT NULL DEFAULT 'manual'
);

-- Unified full-text index, maintained by the repository layer on every write.
CREATE VIRTUAL TABLE search_index USING fts5(
  kind UNINDEXED,
  ref_id UNINDEXED,
  title,
  body,
  tokenize = 'porter unicode61 remove_diacritics 2'
);
`,
  },
  {
    id: 2,
    name: "ideation",
    sql: `
-- Content ideas: actionable, platform-specific angles backed by research objects.
CREATE TABLE ideas (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  hook TEXT,
  angle TEXT,                                  -- the untold angle
  why_untold TEXT,                             -- why mainstream coverage has missed it
  why_it_lands TEXT,                           -- why the audience would care
  format TEXT NOT NULL,                        -- see lib/ideation/formats.ts
  medium TEXT NOT NULL DEFAULT 'visual',       -- visual | written
  angle_type TEXT,                             -- e.g. hidden-history, follow-the-money
  backing TEXT NOT NULL DEFAULT '{}',          -- JSON {clusters:[], sources:[], questions:[]}
  open_questions TEXT NOT NULL DEFAULT '[]',
  effort TEXT,                                 -- low | medium | high
  timeliness TEXT,                             -- evergreen | timely | breaking
  status TEXT NOT NULL DEFAULT 'new',          -- new | saved | skipped | developing | made | dropped
  reason TEXT,                                 -- why skipped/saved, from the user
  origin TEXT NOT NULL DEFAULT 'ai',           -- ai | user
  batch_id TEXT,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  inspiration_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_ideas_status ON ideas(status);

-- Things the user found inspiring: links or notes, with what they want from them.
CREATE TABLE inspirations (
  id TEXT PRIMARY KEY,
  url TEXT,
  kind TEXT NOT NULL DEFAULT 'other',          -- youtube | instagram | tiktok | x | paper | article | text | other
  title TEXT,
  author TEXT,
  description TEXT,
  thumbnail TEXT,
  note TEXT,                                   -- the user's own words: why it matters
  intents TEXT NOT NULL DEFAULT '[]',          -- recreate-format | cover-topic | dig-deeper | other-angles
  analysis TEXT,                               -- JSON, AI analysis (on request)
  matched_clusters TEXT NOT NULL DEFAULT '[]', -- locally matched stories
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Behaviour signals that personalise ideation (all local; summarised by AI only on request).
CREATE TABLE taste_events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                          -- idea-save | idea-skip | idea-develop | idea-made | inspiration | story-like | story-dislike
  object_type TEXT,
  object_id TEXT,
  format TEXT,
  angle_type TEXT,
  tags TEXT NOT NULL DEFAULT '[]',             -- words/entities characterising the object
  reason TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_taste_created ON taste_events(created_at);
`,
  },
  {
    id: 3,
    name: "channels",
    sql: `
-- Channels: separate creator personalities/brands sharing one news database.
CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  profile TEXT NOT NULL DEFAULT '',           -- who/what/audience/format, steers all AI
  taste_summary TEXT NOT NULL DEFAULT '',
  taste_updated_at TEXT,
  geo TEXT NOT NULL DEFAULT 'US',             -- country code for trending searches
  daily_ideas INTEGER NOT NULL DEFAULT 0,     -- opt-in: generate a fresh batch each day
  last_daily_at TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE channel_feeds (
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, feed_id)
);

INSERT INTO channels (id, name, description, profile, taste_summary, taste_updated_at, geo, position, created_at, updated_at)
VALUES (
  'ch_default', 'Politics & current affairs', 'News, geopolitics, power and history',
  COALESCE((SELECT json_extract(value, '$') FROM settings WHERE key = 'profile.about'), ''),
  COALESCE((SELECT json_extract(value, '$') FROM settings WHERE key = 'taste.summary'), ''),
  (SELECT json_extract(value, '$') FROM settings WHERE key = 'taste.updated_at'),
  'BD', 0, datetime('now'), datetime('now')
);
INSERT INTO channels (id, name, description, geo, position, created_at, updated_at)
VALUES ('ch_culture', 'Books, film & culture', 'Books, cinema, music, pop culture and the stories behind them', 'BD', 1, datetime('now'), datetime('now'));

INSERT INTO channel_feeds (channel_id, feed_id) SELECT 'ch_default', id FROM feeds;

ALTER TABLE ideas ADD COLUMN channel_id TEXT;
ALTER TABLE inspirations ADD COLUMN channel_id TEXT;
ALTER TABLE taste_events ADD COLUMN channel_id TEXT;
ALTER TABLE projects ADD COLUMN channel_id TEXT;
UPDATE ideas SET channel_id = 'ch_default';
UPDATE inspirations SET channel_id = 'ch_default';
UPDATE taste_events SET channel_id = 'ch_default';
UPDATE projects SET channel_id = 'ch_default';

-- Ideas can now carry packaging (title options, thumbnail, scores) and expansions of the user's own ideas.
ALTER TABLE ideas ADD COLUMN packaging TEXT;   -- JSON {titles:[], thumbnail, firstSeconds, scores:{...}}
ALTER TABLE ideas ADD COLUMN expansion TEXT;   -- JSON for user-pitched ideas: angles, outline, next steps, leads
ALTER TABLE ideas ADD COLUMN proposal TEXT;    -- Markdown proposal / pitch document
ALTER TABLE ideas ADD COLUMN pitch TEXT;       -- the user's own words
ALTER TABLE ideas ADD COLUMN source_kind TEXT; -- news | trend | history | archive | statement | inspiration | pitch
`,
  },
  {
    id: 4,
    name: "channel-taste",
    sql: `
ALTER TABLE channels ADD COLUMN color TEXT NOT NULL DEFAULT 'coral';
ALTER TABLE channels ADD COLUMN news_ratio INTEGER NOT NULL DEFAULT 60;      -- % of ideas tied to current news vs evergreen
ALTER TABLE channels ADD COLUMN boost_terms TEXT NOT NULL DEFAULT '';        -- comma-separated people/topics to prioritise
ALTER TABLE channels ADD COLUMN mute_terms TEXT NOT NULL DEFAULT '';         -- comma-separated people/topics to play down
ALTER TABLE channels ADD COLUMN good_examples TEXT NOT NULL DEFAULT '';      -- ideas/titles the creator would jump on
ALTER TABLE channels ADD COLUMN bad_examples TEXT NOT NULL DEFAULT '';       -- ideas that feel boring/obvious to them
ALTER TABLE channels ADD COLUMN reference_creators TEXT NOT NULL DEFAULT ''; -- creators whose style to aim for

UPDATE channels SET color = 'coral', news_ratio = 60,
  boost_terms = 'Bangladesh, Dhaka, BNP, Jamaat, Awami League, Tarique Rahman, Yunus, Rohingya, Teesta, India, Pakistan, Myanmar',
  mute_terms = 'Trump',
  good_examples = 'Turkey''s president called Tarique Rahman "my beloved brother" and promised to do whatever Turkey can — but what can Turkey actually do for Bangladesh, and why does Erdogan want Bangladesh?
GTA VI will increase food-delivery orders — and that will create a massive change for riders and platforms.
Why are the countries behind the most damage in the world (Xi, Trump, Putin, maybe Kim Jong Un) talking about world peace?
Nvidia''s Worst Nightmare Just Came True — and It''s Not Jensen Huang
Can Japan''s Economy Afford Takaichi''s Big Bet?
Why Do Muslims Flee to Europe Instead of Rich Arab Countries?',
  bad_examples = 'Govt eases tender rules for deprived bidders under amended procurement law (procedural, nobody cares without an angle)
Trump breaks silence about FAA nationwide ground stop, blames Biden administration (generic, not relevant to the audience)
Hasina will return to Bangladesh in December (already widely known for months — only with a genuinely new angle)',
  reference_creators = 'Johnny Harris, TLDR News, PeekTV, Warfronts, Dylan Page'
WHERE id = 'ch_default';
UPDATE channels SET color = 'teal', news_ratio = 40 WHERE id = 'ch_culture';
`,
  },
  {
    id: 5,
    name: "channel-links",
    sql: `
ALTER TABLE channels ADD COLUMN links TEXT NOT NULL DEFAULT '{}';  -- JSON {youtube, instagram, facebook, tiktok}: the creator's own accounts
ALTER TABLE channels ADD COLUMN youtube_channel_id TEXT;            -- resolved from the YouTube link (UC…)

UPDATE channels SET
  links = '{"youtube":"https://www.youtube.com/@aninditarhine","instagram":"https://www.instagram.com/anindita.rhine","facebook":"https://www.facebook.com/share/1515H3Qucqx/","tiktok":"https://www.tiktok.com/@anindita.rhine"}',
  youtube_channel_id = 'UCIsWcCRLew0d0T11q1f2_ug'
WHERE id = 'ch_default';
`,
  },
  {
    id: 6,
    name: "production",
    sql: `
-- Projects become content items: what kind of piece, where it is in production, when it goes out,
-- and its working documents (script, shot list, thumbnail, cut-downs, captions).
ALTER TABLE projects ADD COLUMN content_type TEXT NOT NULL DEFAULT 'video';     -- video | short | series | podcast | interview | sponsored | carousel | article
ALTER TABLE projects ADD COLUMN production_stage TEXT NOT NULL DEFAULT 'idea'; -- idea | research | script | record | edit | publish | live
ALTER TABLE projects ADD COLUMN publish_date TEXT;                             -- YYYY-MM-DD
ALTER TABLE projects ADD COLUMN platforms TEXT NOT NULL DEFAULT '[]';           -- JSON ["youtube","instagram",…]
ALTER TABLE projects ADD COLUMN series_name TEXT;
ALTER TABLE projects ADD COLUMN guest TEXT;
ALTER TABLE projects ADD COLUMN sponsor TEXT;
ALTER TABLE projects ADD COLUMN published_url TEXT;
ALTER TABLE projects ADD COLUMN production TEXT NOT NULL DEFAULT '{}';          -- JSON {script, shots, thumbnail, cutdowns, captions}
CREATE INDEX idx_projects_publish ON projects(publish_date);

-- Old scripts pasted by the creator, so drafts sound like them.
ALTER TABLE channels ADD COLUMN voice_samples TEXT NOT NULL DEFAULT '';

-- Fresh AI ideas twice a day for the main channel (budgets still apply; switch off in Settings → Channels).
UPDATE channels SET daily_ideas = 1 WHERE id = 'ch_default';
`,
  },
  {
    id: 7,
    name: "transcripts-and-research",
    sql: `
-- Talk-show/podcast transcripts (YouTube captions), cached per video, plus the AI read of an episode.
CREATE TABLE transcripts (
  video_id TEXT PRIMARY KEY,
  article_id TEXT,
  language TEXT,
  kind TEXT,                         -- asr (automatic) | manual
  segments TEXT NOT NULL DEFAULT '[]', -- JSON [{t, d, text}] seconds
  chars INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,              -- ok | none | error
  error TEXT,
  mined TEXT,                        -- JSON, AI read of the episode
  mined_at TEXT,
  fetched_at TEXT NOT NULL
);
CREATE INDEX idx_transcripts_article ON transcripts(article_id);

-- The creator's own research: links, pasted text, files, quick notes.
CREATE TABLE research_items (
  id TEXT PRIMARY KEY,
  channel_id TEXT,
  kind TEXT NOT NULL,                -- link | text | file | note
  url TEXT,
  title TEXT NOT NULL,
  body TEXT,                         -- full text (article text, pasted text, transcript, file read)
  summary TEXT,
  note TEXT,
  file_path TEXT,
  file_type TEXT,
  status TEXT NOT NULL DEFAULT 'ready', -- ready | thin | needs_read | failed
  error TEXT,
  source_id TEXT,
  matched_clusters TEXT NOT NULL DEFAULT '[]',
  project_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_research_items_created ON research_items(created_at);
`,
  },
  {
    id: 8,
    name: "performance",
    sql: `
-- The creator's own posts on every platform, with their numbers (YouTube via API; others via CSV export).
CREATE TABLE own_posts (
  id TEXT PRIMARY KEY,               -- platform:post id
  channel_id TEXT,
  platform TEXT NOT NULL,            -- youtube | instagram | facebook | tiktok
  post_id TEXT NOT NULL,
  url TEXT,
  title TEXT NOT NULL DEFAULT '',
  kind TEXT,                         -- short | video | reel | post | carousel | story | live
  published_at TEXT,
  duration_s INTEGER,
  views INTEGER, reach INTEGER, likes INTEGER, comments INTEGER, shares INTEGER, saves INTEGER, follows INTEGER,
  thumbnail TEXT,
  source TEXT NOT NULL,              -- api | csv
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_own_posts_platform ON own_posts(channel_id, platform, published_at);

-- Account totals over time (followers, views), one row per platform per day.
CREATE TABLE own_daily (
  channel_id TEXT,
  platform TEXT NOT NULL,
  date TEXT NOT NULL,
  followers INTEGER, views INTEGER, likes INTEGER, comments INTEGER, shares INTEGER, profile_views INTEGER,
  PRIMARY KEY (channel_id, platform, date)
);

-- Public comments on the creator's own videos.
CREATE TABLE own_comments (
  id TEXT PRIMARY KEY,
  channel_id TEXT,
  platform TEXT NOT NULL,
  post_id TEXT NOT NULL,
  author TEXT,
  text TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  fetched_at TEXT NOT NULL
);
CREATE INDEX idx_own_comments_post ON own_comments(post_id);

-- AI reads: comment insights and strategist reports.
CREATE TABLE own_reports (
  id TEXT PRIMARY KEY,
  channel_id TEXT,
  kind TEXT NOT NULL,                -- comments | strategy
  body TEXT NOT NULL,                -- JSON
  created_at TEXT NOT NULL
);
`,
  },
  {
    id: 9,
    name: "channel-meta-page",
    sql: `
-- Which Facebook Page (and its linked Instagram) belongs to each channel, when one Meta token sees several.
ALTER TABLE channels ADD COLUMN meta_page_id TEXT;
`,
  },
  {
    id: 10,
    name: "rhine-reviews-channel",
    sql: `
-- The culture channel is the Rhine Reviews persona: its accounts, name and Meta Page.
UPDATE channels SET
  name = 'Rhine Reviews',
  links = '{"instagram":"https://www.instagram.com/rhinereviews","facebook":"https://www.facebook.com/321015124985241"}',
  meta_page_id = '321015124985241'
WHERE id = 'ch_culture';

-- A separate "Rhine Reviews" channel made before the merge: move its numbers over, then remove it.
UPDATE own_posts SET channel_id = 'ch_culture' WHERE channel_id IN (SELECT id FROM channels WHERE name = 'Rhine Reviews' AND id != 'ch_culture');
UPDATE OR IGNORE own_daily SET channel_id = 'ch_culture' WHERE channel_id IN (SELECT id FROM channels WHERE name = 'Rhine Reviews' AND id != 'ch_culture');
DELETE FROM own_daily WHERE channel_id IN (SELECT id FROM channels WHERE name = 'Rhine Reviews' AND id != 'ch_culture');
UPDATE own_comments SET channel_id = 'ch_culture' WHERE channel_id IN (SELECT id FROM channels WHERE name = 'Rhine Reviews' AND id != 'ch_culture');
UPDATE ideas SET channel_id = 'ch_culture' WHERE channel_id IN (SELECT id FROM channels WHERE name = 'Rhine Reviews' AND id != 'ch_culture');
UPDATE settings SET value = '"ch_default"' WHERE key = 'channel.active' AND value IN (SELECT '"' || id || '"' FROM channels WHERE name = 'Rhine Reviews' AND id != 'ch_culture');
DELETE FROM channel_feeds WHERE channel_id IN (SELECT id FROM channels WHERE name = 'Rhine Reviews' AND id != 'ch_culture');
DELETE FROM channels WHERE name = 'Rhine Reviews' AND id != 'ch_culture';

-- The main channel's Facebook Page (Anindita H. Rhine, with @anindita.rhine linked).
UPDATE channels SET meta_page_id = '1027427880451032' WHERE id = 'ch_default' AND meta_page_id IS NULL;
`,
  },
  {
    id: 11,
    name: "talk-per-channel",
    sql: `
-- Talk shows switched off for a channel (everything else stays on).
CREATE TABLE channel_talk_off (
  channel_id TEXT NOT NULL,
  feed_id TEXT NOT NULL,
  PRIMARY KEY (channel_id, feed_id)
);
-- Politics channel: drop the shows that are mostly noise for Bangladesh current affairs.
INSERT OR IGNORE INTO channel_talk_off (channel_id, feed_id)
  SELECT 'ch_default', id FROM feeds WHERE category = 'talk' AND name IN ('The Joe Rogan Experience', 'Tucker Carlson', 'PBD Podcast', 'Chris Williamson (Modern Wisdom)', 'BeerBiceps (The Ranveer Show)');
-- Rhine Reviews (culture): keep culture/history/long-form conversation shows, switch off the news talk shows.
INSERT OR IGNORE INTO channel_talk_off (channel_id, feed_id)
  SELECT 'ch_culture', id FROM feeds WHERE category = 'talk' AND name NOT IN ('The Rest Is History', 'Lex Fridman', 'The Diary Of A CEO', 'Hasan Minhaj', 'Chris Williamson (Modern Wisdom)', 'BeerBiceps (The Ranveer Show)', 'DW Alap');
`,
  },
  {
    id: 12,
    name: "voice-lab",
    sql: `
-- Voice Lab: scripts and videos (yours and your inspirations) that teach the writer how to sound.
CREATE TABLE voice_sources (
  id TEXT PRIMARY KEY,
  channel_id TEXT,
  kind TEXT NOT NULL,                -- mine | inspiration
  title TEXT NOT NULL,
  url TEXT,
  platform TEXT,                     -- youtube | instagram | tiktok | facebook | text
  creator TEXT,
  text TEXT,
  status TEXT NOT NULL DEFAULT 'ready', -- ready | queued (waiting for the Mac helper) | failed
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_voice_sources_channel ON voice_sources(channel_id, kind);

-- One voice per channel: the written guides (AI-drafted, yours to edit), dials, presets, banned phrases.
CREATE TABLE voice_profiles (
  channel_id TEXT PRIMARY KEY,
  guide_mine TEXT NOT NULL DEFAULT '',
  guide_inspiration TEXT NOT NULL DEFAULT '',
  dials TEXT NOT NULL DEFAULT '{}',
  presets TEXT NOT NULL DEFAULT '[]',
  banned TEXT NOT NULL DEFAULT '',
  analysed_at TEXT,
  updated_at TEXT NOT NULL
);

-- What you changed in AI drafts: the writer learns from these.
CREATE TABLE script_edits (
  id TEXT PRIMARY KEY,
  channel_id TEXT,
  project_id TEXT,
  before_text TEXT NOT NULL,
  after_text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_script_edits_project ON script_edits(project_id);

-- Social videos added to My research get transcribed by the Mac helper too.
ALTER TABLE research_items ADD COLUMN media_status TEXT; -- queued | done | failed
`,
  },
  {
    id: 13,
    name: "voice-samples-to-voice-lab",
    sql: `
-- Old "paste your scripts" text moves into Voice Lab as your own source.
INSERT INTO voice_sources (id, channel_id, kind, title, platform, text, status, created_at, updated_at)
  SELECT 'vs_' || id, id, 'mine', 'Scripts pasted in Settings', 'text', voice_samples, 'ready', datetime('now'), datetime('now')
  FROM channels WHERE TRIM(COALESCE(voice_samples, '')) != '';
`,
  },
  {
    id: 14,
    name: "story-notes",
    sql: `
-- Editor's note per story (short AI read, cheapest model): why it matters, content options, viewer questions.
ALTER TABLE clusters ADD COLUMN note TEXT;
`,
  },
  {
    id: 15,
    name: "channel-prefs",
    sql: `
-- Structured preferences per channel: topic and format mix, boldness, depth, question style, automatic notes.
ALTER TABLE channels ADD COLUMN prefs TEXT NOT NULL DEFAULT '{}';
`,
  },
  {
    id: 16,
    name: "full-text",
    sql: `
-- Full article text for stories that matter, read once after each refresh.
ALTER TABLE articles ADD COLUMN full_text TEXT;
ALTER TABLE articles ADD COLUMN text_status TEXT;   -- full | summary (paywalled/short) | headline (Google News only) | blocked (helper retries) | failed
ALTER TABLE articles ADD COLUMN direct_url TEXT;    -- the outlet's own link, for Google News items matched to a direct article
CREATE INDEX idx_articles_text_status ON articles(text_status);
`,
  },
  {
    id: 17,
    name: "translations",
    sql: `
-- English translations of Bangla content, made for free on the Mac (offline model), never by paid AI.
CREATE TABLE translations (
  kind TEXT NOT NULL,                -- transcript (video id) | article | research | voice
  ref_id TEXT NOT NULL,
  parts TEXT NOT NULL,               -- JSON array of English texts, aligned with the original's parts
  model TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (kind, ref_id)
);
`,
  },
  {
    id: 18,
    name: "monetise",
    sql: `
-- Monetisation: the creator's own editable library (seeded from the built-in playbook), sponsors, series and proposals.
CREATE TABLE mon_items (
  id TEXT PRIMARY KEY, channel_id TEXT, kind TEXT NOT NULL, title TEXT NOT NULL, how TEXT NOT NULL DEFAULT '', example TEXT NOT NULL DEFAULT '',
  formats TEXT NOT NULL DEFAULT '[]', goals TEXT NOT NULL DEFAULT '[]', effort TEXT, sensitive_ok INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'mine', starred INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE mon_sponsors (
  id TEXT PRIMARY KEY, channel_id TEXT, name TEXT NOT NULL, category TEXT NOT NULL, fits TEXT NOT NULL DEFAULT '[]', notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'idea', contact TEXT NOT NULL DEFAULT '', last_contact TEXT, source TEXT NOT NULL DEFAULT 'mine',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE mon_series (
  id TEXT PRIMARY KEY, channel_id TEXT, name TEXT NOT NULL, premise TEXT NOT NULL DEFAULT '', episodes TEXT NOT NULL DEFAULT '[]', categories TEXT NOT NULL DEFAULT '[]',
  format TEXT NOT NULL DEFAULT '', integration TEXT NOT NULL DEFAULT '', sentiment TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'idea',
  source TEXT NOT NULL DEFAULT 'mine', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE mon_proposals (
  id TEXT PRIMARY KEY, channel_id TEXT, sponsor_id TEXT, series_id TEXT, project_id TEXT, title TEXT NOT NULL, body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', price_low INTEGER, price_high INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
ALTER TABLE channels ADD COLUMN monetise TEXT NOT NULL DEFAULT '{}';
`,
  },
  {
    id: 19,
    name: "youtube-studio",
    sql: `
-- YouTube channels being built (each can draw on one of the Desk's channels for news, ideas and voice).
CREATE TABLE yt_channels (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, handle TEXT NOT NULL DEFAULT '', niche TEXT NOT NULL DEFAULT '', desk_channel_id TEXT, youtube_id TEXT,
  status TEXT NOT NULL DEFAULT 'planned',  -- active | launching | planned | later
  priority INTEGER NOT NULL DEFAULT 5, positioning TEXT NOT NULL DEFAULT '', audience TEXT NOT NULL DEFAULT '', pillars TEXT NOT NULL DEFAULT '[]',
  formats TEXT NOT NULL DEFAULT '[]', cadence TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', watch_hours REAL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
-- Competitors per YouTube channel, and their recent videos (from the YouTube API).
CREATE TABLE yt_competitors (
  id TEXT PRIMARY KEY, yt_channel_id TEXT NOT NULL, youtube_id TEXT NOT NULL, name TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', fetched_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE yt_comp_videos (
  video_id TEXT PRIMARY KEY, competitor_id TEXT NOT NULL, title TEXT NOT NULL, published_at TEXT, views INTEGER, comments INTEGER, seconds INTEGER, thumbnail TEXT, fetched_at TEXT NOT NULL
);
-- Ticked checklist items (set-up, channel launch, per-project workflow).
CREATE TABLE yt_checks (scope TEXT NOT NULL, key TEXT NOT NULL, done_at TEXT NOT NULL, PRIMARY KEY (scope, key));
`,
  },
  {
    id: 20,
    name: "expert-library",
    sql: `
-- Solutions & expert views: research, policy briefs, opinion, official texts, videos, background — gathered free per story/project/topic.
CREATE TABLE expert_items (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL, ref_id TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL,
  publisher TEXT, authors TEXT, year INTEGER, snippet TEXT, provider TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]', score REAL NOT NULL DEFAULT 0,
  saved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
  UNIQUE (scope, ref_id, url)
);
CREATE INDEX idx_expert_items_ref ON expert_items(scope, ref_id);
CREATE TABLE expert_runs (scope TEXT NOT NULL, ref_id TEXT NOT NULL, query TEXT NOT NULL, fetched_at TEXT NOT NULL, PRIMARY KEY (scope, ref_id));
CREATE TABLE expert_briefs (scope TEXT NOT NULL, ref_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (scope, ref_id));
`,
  },
  {
    id: 21,
    name: "expert-ai-notes",
    sql: `
-- "Ask AI about this": the answer for one expert item, kept so it's never paid for twice.
ALTER TABLE expert_items ADD COLUMN ai_note TEXT;
`,
  },
  {
    id: 22,
    name: "fresher-news",
    sql: `
-- News felt stale: check feeds at least every 10 minutes (the Studio picker can still change it).
UPDATE settings SET value = '10' WHERE key = 'ingest.interval_minutes' AND CAST(value AS INTEGER) > 10;
`,
  },
  {
    id: 23,
    name: "secrets-and-cloud-jobs",
    sql: `
-- Keys the creator pastes in the app (e.g. the transcript service). Never sent back to the browser.
CREATE TABLE secrets (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
`,
  },
];
