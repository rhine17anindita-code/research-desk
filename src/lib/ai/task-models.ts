/**
 * Which model does which job. Each group has a sensible default (best model where
 * quality matters most, cheapest for quick jobs); the user can override any group
 * in Settings → AI & usage. Applies to the Anthropic provider.
 */
export interface TaskGroup {
  id: string;
  label: string;
  hint: string;
  prefixes: string[];
  defaultModel: string;
}

export const TASK_GROUPS: TaskGroup[] = [
  { id: "ideas", label: "Content ideas", hint: "Idea batches and daily ideas", prefixes: ["ideas."], defaultModel: "claude-opus-5-5" },
  { id: "writing", label: "Scripts, outlines, pitches & proposals", hint: "Expanding your ideas, angles, outlines, proposals", prefixes: ["creator.", "pitch.", "script."], defaultModel: "claude-opus-5-5" },
  { id: "packaging", label: "Shot lists, thumbnails, cut-downs & captions", hint: "Packaging a finished script", prefixes: ["package."], defaultModel: "claude-sonnet-5-5" },
  { id: "talk", label: "Reading talk shows & podcasts", hint: "Mining an episode's transcript for claims, quotes and ideas", prefixes: ["talk."], defaultModel: "claude-sonnet-5-5" },
  { id: "deep", label: "Deep research", hint: "Multi-source research briefs", prefixes: ["deep."], defaultModel: "claude-opus-5-5" },
  { id: "answers", label: "Research questions & answers", hint: "Generating questions, quick and explored answers", prefixes: ["questions.", "answers."], defaultModel: "claude-sonnet-5-5" },
  { id: "assistant", label: "Assistant chat", hint: "Conversations on stories, questions and projects", prefixes: ["assistant."], defaultModel: "claude-sonnet-5-5" },
  { id: "light", label: "Quick jobs", hint: "Story briefs, story scoring, inspiration analysis, taste summary, reading your files", prefixes: ["story.", "inspiration.", "taste.", "research."], defaultModel: "claude-haiku-5-5" },
];

export function groupForTask(task: string): TaskGroup | undefined {
  return TASK_GROUPS.find((g) => g.prefixes.some((p) => task.startsWith(p)));
}

/** Model for a task: the user's choice for its group, else the group default, else the global model. */
export function modelForTask(task: string | undefined, overrides: Record<string, string>, fallback: string): string {
  if (!task) return fallback;
  const g = groupForTask(task);
  if (!g) return fallback;
  return overrides[g.id] || g.defaultModel;
}
