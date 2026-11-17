import type { z } from "zod";

export interface CompletionRequest {
  system: string;
  user: string;
  /** JSON Schema the reply must conform to (structured output). */
  jsonSchema: Record<string, unknown>;
  maxTokens: number;
  model: string;
  effort?: "low" | "medium" | "high";
  /** Images or PDFs to read alongside the text (Anthropic only). Base64 data. */
  files?: AiFile[];
}

export interface AiFile { mediaType: string; data: string }

export interface CompletionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface AiProvider {
  id: string;
  /** True when credentials are present on the server. Never exposes the key. */
  isConfigured(): boolean;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}

export type AiFailureReason = "disabled" | "not_configured" | "budget" | "provider_error" | "invalid_output";

export type AiResult<T> =
  | { ok: true; data: T; cached: boolean; requestId: string; model: string; costUsd: number }
  | { ok: false; reason: AiFailureReason; message: string };

export interface AiTask<T> {
  /** Short task name for logs/budgets, e.g. "questions.generate". */
  task: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens: number;
  /** Parts that identify an equivalent request; same parts + model ⇒ cached reply reused. */
  cacheParts?: unknown[];
  /** Skip the cache lookup (explicit regenerate). The new result still replaces the cache entry. */
  bypassCache?: boolean;
  /** Use the configured bulk model (cheaper) when set. */
  bulk?: boolean;
  /** Images or PDFs to read (Anthropic only). */
  files?: AiFile[];
  /** Rough input tokens the files add, for the cost estimate. */
  fileTokens?: number;
}
