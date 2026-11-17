/** Shared view-model types used by server components, API routes and client components. */

export type Origin = "external" | "user" | "ai" | "assistant";

export interface Article {
  id: string;
  feedId: string | null;
  clusterId: string | null;
  url: string;
  title: string;
  summary: string | null;
  author: string | null;
  publisher: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  region: string | null;
  imageUrl: string | null;
  entities: string[];
  isSample: boolean;
}

export interface StoryBrief {
  explanation: string;
  whyItMatters: string;
  coverageDifferences: string[];
  unknowns: string[];
  generatedAt: string;
  model: string;
}

export interface Story {
  id: string;
  headline: string;
  summary: string | null;
  firstSeenAt: string;
  lastUpdatedAt: string;
  articleCount: number;
  sourceCount: number;
  entities: string[];
  regions: string[];
  state: "new" | "saved" | "dismissed";
  rating: number;
  isSample: boolean;
  brief: StoryBrief | null;
  assessment: { signals: { id: string; strength: number; reason: string }[]; note: string; model: string } | null;
}

export const QUESTION_DIMENSIONS = [
  "meaning",
  "mechanism",
  "consequences",
  "incentives",
  "feasibility",
  "precedent",
  "contradiction",
  "missing-information",
  "relationships",
  "editorial-opportunity",
  "audience",
] as const;
export type QuestionDimension = (typeof QUESTION_DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<string, string> = {
  meaning: "Meaning",
  mechanism: "Mechanism",
  consequences: "Consequences",
  incentives: "Interests & incentives",
  feasibility: "Feasibility",
  precedent: "Historical precedent",
  contradiction: "Contradictions",
  "missing-information": "Missing information",
  relationships: "Relationships",
  "editorial-opportunity": "Editorial opportunity",
  audience: "What viewers wonder",
};

/** What we currently know about whether the question can be answered. */
export const ANSWER_STATES = ["unexamined", "established", "partial", "contested", "needs-investigation", "open", "insufficient"] as const;
export type AnswerState = (typeof ANSWER_STATES)[number];

export const ANSWER_STATE_LABELS: Record<string, string> = {
  unexamined: "Unexamined",
  established: "Established answer",
  partial: "Partial answer",
  contested: "Contested",
  "needs-investigation": "Needs original investigation",
  open: "Open question",
  insufficient: "Insufficient evidence",
};

export interface Question {
  id: string;
  clusterId: string | null;
  projectId: string | null;
  parentId: string | null;
  text: string;
  dimension: string | null;
  rationale: string | null;
  answerState: AnswerState;
  priority: number;
  searchTerms: string[];
  origin: "ai" | "user" | "assistant";
  followed: boolean;
  archived: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
  answerCount?: number;
  sourceCount?: number;
}

export type ClaimKind = "fact" | "background" | "interpretation" | "allegation" | "prediction" | "hypothesis";

export interface AnswerPoint {
  text: string;
  kind: ClaimKind;
  sourceIds: string[];
  /** Set by validation when a factual claim had no usable source. */
  unsupported?: boolean;
}

export interface DeepBrief {
  question: string;
  findings: { heading: string; detail: string; sourceIds: string[] }[];
  competingExplanations: { explanation: string; evidenceFor: string; evidenceAgainst: string; sourceIds: string[] }[];
  gaps: string[];
  angles: string[];
}

export interface Answer {
  id: string;
  questionId: string;
  level: number;
  state: string;
  summary: string;
  points: AnswerPoint[];
  caveats: string[];
  nextSteps: string[];
  brief: DeepBrief | null;
  origin: "ai" | "user";
  model: string | null;
  superseded: boolean;
  createdAt: string;
}

export const SOURCE_KINDS = [
  "news", "paper", "report", "government", "statistics", "law", "archive", "commentary", "primary", "reference", "other",
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export interface Source {
  id: string;
  kind: SourceKind;
  title: string;
  authors: string | null;
  publisher: string | null;
  publishedAt: string | null;
  url: string | null;
  doi: string | null;
  excerpt: string | null;
  retrievedAt: string;
  provider: string;
  articleId: string | null;
  notes: string | null;
  saved: boolean;
  createdAt: string;
  /** When listed for a question. */
  status?: "candidate" | "attached" | "rejected";
  foundBy?: string | null;
}

export interface Evidence {
  id: string;
  answerId: string;
  sourceId: string;
  claim: string;
  passage: string | null;
  relation: "supports" | "contradicts" | "context";
}

export const LINK_RELATIONS = [
  { id: "related_to", label: "is related to" },
  { id: "follow_up_of", label: "is a follow-up to" },
  { id: "supports", label: "supports" },
  { id: "contradicts", label: "contradicts" },
  { id: "resembles", label: "resembles (precedent)" },
  { id: "updates", label: "updates" },
  { id: "context_for", label: "gives context for" },
  { id: "part_of", label: "is part of" },
  { id: "derived_from", label: "was derived from" },
] as const;

export type ObjectType = "cluster" | "question" | "answer" | "source" | "project" | "note" | "article";

export interface Link {
  id: string;
  fromType: ObjectType;
  fromId: string;
  toType: ObjectType;
  toId: string;
  relation: string;
  note: string | null;
  origin: string;
  createdAt: string;
  /** Resolved display info for the other end. */
  otherType?: ObjectType;
  otherId?: string;
  otherTitle?: string;
  direction?: "out" | "in";
}

export interface Project {
  id: string;
  title: string;
  thesis: string | null;
  description: string | null;
  stage: string;
  angles: string | null;
  gaps: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  projectId: string | null;
  clusterId: string | null;
  questionId: string | null;
  title: string | null;
  body: string;
  origin: "user" | "assistant";
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  meta: { citedSourceIds?: string[]; suggestedQuestions?: string[]; retrieved?: number; cached?: boolean; error?: boolean };
  createdAt: string;
}
