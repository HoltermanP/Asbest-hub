/**
 * Model routing per task type.
 * - haiku: classification and extraction of short fields
 * - sonnet: everything that writes, reasons or assesses
 */
export type TaskType =
  | "classify"
  | "extract_fields"
  | "extract_findings"
  | "write_document"
  | "reason"
  | "assess"
  | "answer_question"
  | "synthesize";

export type ModelTier = "fast" | "reasoning";

export const DEFAULT_MODELS: Record<ModelTier, string> = {
  fast: "claude-haiku-4-5",
  reasoning: "claude-sonnet-4-6",
};

export function tierForTask(task: TaskType): ModelTier {
  switch (task) {
    case "classify":
    case "extract_fields":
      return "fast";
    default:
      return "reasoning";
  }
}

export function modelForTask(task: TaskType, overrides?: Partial<Record<ModelTier, string>>): string {
  const tier = tierForTask(task);
  const fromEnv = tier === "fast" ? process.env.AI_MODEL_FAST : process.env.AI_MODEL_REASONING;
  return overrides?.[tier] ?? fromEnv ?? DEFAULT_MODELS[tier];
}

/** USD per million tokens. Used for cost registration in the audit log. */
export interface ModelPricing {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

const PRICING: Record<string, ModelPricing> = {
  "claude-sonnet-4-6": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
  "claude-sonnet-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "text-embedding-3-large": { input: 0.13, output: 0, cacheWrite: 0, cacheRead: 0 },
  "whisper-1": { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
};

export function pricingFor(model: string): ModelPricing {
  const exact = PRICING[model];
  if (exact) return exact;
  const key = Object.keys(PRICING).find((k) => model.startsWith(k));
  return key ? PRICING[key]! : { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 };
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export function estimateCostUsd(model: string, usage: Usage): number {
  const p = pricingFor(model);
  return (
    (usage.inputTokens * p.input +
      usage.outputTokens * p.output +
      usage.cacheReadTokens * p.cacheRead +
      usage.cacheWriteTokens * p.cacheWrite) /
    1_000_000
  );
}
