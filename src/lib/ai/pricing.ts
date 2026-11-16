/**
 * USD per million tokens. Used only for *estimates* shown in the usage panel and
 * for budget enforcement; your provider's invoice is authoritative.
 * Unknown models (e.g. local Ollama) are treated as free unless you add them here.
 */
export const MODEL_PRICING: Record<string, { input: number; output: number; label: string }> = {
  "claude-opus-5-5": { input: 4, output: 20, label: "Claude Opus 5.5 — best quality (default), standard cost" },
  "claude-sonnet-5-5": { input: 2, output: 10, label: "Claude Sonnet 5.5 — very good, about half the cost" },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, label: "Claude Haiku 5.5 — fast, about 1/40 of the cost" },
  "claude-fable-5-2": { input: 8, output: 40, label: "Claude Fable 5.2 — maximum capability, about 2× the cost" },
};

export const ANTHROPIC_MODELS = Object.keys(MODEL_PRICING);

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = MODEL_PRICING[model];
  if (!p) return 0;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

/** Rough token estimate (≈4 characters per token for English prose). */
export function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
