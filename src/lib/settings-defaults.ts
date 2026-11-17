export type AiProviderId = "anthropic" | "openai_compatible";
export type Effort = "low" | "medium" | "high";

export interface PipelineStage {
  id: string;
  label: string;
}

export interface AppSettings {
  "ai.enabled": boolean;
  "ai.provider": AiProviderId;
  "ai.model": string;
  /** Optional cheaper model for high-volume tasks (story assessment). Empty = use ai.model. */
  "ai.bulk_model": string;
  "ai.effort": Effort;
  "ai.openai_base_url": string;
  "budget.daily_usd": number;
  "budget.monthly_usd": number;
  "budget.per_task_usd": number;
  "discover.window_hours": number;
  "discover.region_weights": Record<string, number>;
  "pipeline.stages": PipelineStage[];
  "retrieval.providers": { openalex: boolean; crossref: boolean; wikipedia: boolean; gdelt: boolean };
  /** Free-text description of the researcher, audience and format; steers AI output. */
  "profile.about": string;
  /** AI-written (user-editable) summary of what the user's behaviour shows they like. */
  "taste.summary": string;
  "taste.updated_at": string;
  "channel.active": string;
  /** Per task-group model overrides (group id → model id); empty = group default. */
  "ai.task_models": Record<string, string>;
}

export const DEFAULT_SETTINGS: AppSettings = {
  "ai.enabled": true,
  "ai.provider": "anthropic",
  "ai.model": "claude-opus-5-5",
  "ai.bulk_model": "",
  "ai.effort": "medium",
  "ai.openai_base_url": "",
  "budget.daily_usd": 2,
  "budget.monthly_usd": 20,
  "budget.per_task_usd": 0.5,
  "discover.window_hours": 96,
  "discover.region_weights": {},
  "pipeline.stages": [
    { id: "discovered", label: "Discovered" },
    { id: "saved", label: "Saved" },
    { id: "investigating", label: "Investigating" },
    { id: "research_ready", label: "Research ready" },
    { id: "in_production", label: "In production" },
    { id: "published", label: "Published" },
    { id: "archived", label: "Archived" },
  ],
  "retrieval.providers": { openalex: true, crossref: true, wikipedia: true, gdelt: true },
  "profile.about": "",
  "taste.summary": "",
  "taste.updated_at": "",
  "channel.active": "ch_default",
  "ai.task_models": {},
};
