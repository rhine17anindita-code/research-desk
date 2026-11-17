import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider, CompletionRequest, CompletionResult } from "./types";

/** Claude via the official Anthropic SDK. Key read from ANTHROPIC_API_KEY on the server only. */
export class AnthropicProvider implements AiProvider {
  id = "anthropic";
  private client: Anthropic | null = null;

  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY?.trim();
  }

  private getClient(): Anthropic {
    if (!this.client) this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 180_000 });
    return this.client;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const client = this.getClient();
    // Server-side refusal fallback is supported on the Opus 5.5 / Sonnet 5.5 / Fable lines.
    const supportsFallback = /^claude-(opus-5-5|sonnet-5-5|fable-5)/.test(req.model);
    const params = {
      model: req.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [
        {
          role: "user" as const,
          content: req.files?.length
            ? [
                ...req.files.map((f) =>
                  f.mediaType === "application/pdf"
                    ? { type: "document", source: { type: "base64", media_type: f.mediaType, data: f.data } }
                    : { type: "image", source: { type: "base64", media_type: f.mediaType, data: f.data } },
                ),
                { type: "text", text: req.user },
              ]
            : req.user,
        },
      ],
      output_config: {
        ...(req.effort ? { effort: req.effort } : {}),
        format: { type: "json_schema", schema: req.jsonSchema },
      },
      ...(supportsFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
    };
    const response = (supportsFallback
      ? await client.beta.messages.create(params as never)
      : await client.messages.create(params as never)) as unknown as {
      content: { type: string; text?: string }[];
      stop_reason: string | null;
      usage: { input_tokens: number; output_tokens: number };
      model: string;
    };
    if (response.stop_reason === "refusal") throw new Error("The model declined this request.");
    if (response.stop_reason === "max_tokens") {
      // Still billed: carry the usage so the budget counts it.
      throw Object.assign(new Error("The reply hit the output limit before finishing."), { usage: { input: response.usage.input_tokens, output: response.usage.output_tokens, model: response.model ?? req.model } });
    }
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
    return { text, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, model: response.model ?? req.model };
  }
}

/**
 * Any OpenAI-compatible chat endpoint (Ollama, LM Studio, OpenRouter, vLLM, OpenAI).
 * Uses JSON mode and validates the result locally.
 */
export class OpenAiCompatibleProvider implements AiProvider {
  id = "openai_compatible";
  constructor(private baseUrlOverride?: string) {}

  private baseUrl(): string {
    return (this.baseUrlOverride || process.env.OPENAI_COMPAT_BASE_URL || "").replace(/\/+$/, "");
  }

  isConfigured(): boolean {
    return !!this.baseUrl();
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    if (req.files?.length) throw new Error("Reading images and PDFs needs the Anthropic provider (Settings → AI).");
    const key = process.env.OPENAI_COMPAT_API_KEY?.trim();
    const res = await fetch(`${this.baseUrl()}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({
        model: req.model,
        max_tokens: req.maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${req.system}\n\nReply with a single JSON object matching this JSON Schema:\n${JSON.stringify(req.jsonSchema)}` },
          { role: "user", content: req.user },
        ],
      }),
      signal: AbortSignal.timeout(240_000),
    });
    if (!res.ok) throw new Error(`Provider HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as { choices: { message: { content: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number }; model?: string };
    return {
      text: json.choices?.[0]?.message?.content ?? "",
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
      model: json.model ?? req.model,
    };
  }
}
