import { afterEach, describe, expect, it } from "vitest";
import { estimateCostUsd, modelForTask, pricingFor, tierForTask } from "@/ai/router";

describe("model router", () => {
  afterEach(() => {
    delete process.env.AI_MODEL_FAST;
    delete process.env.AI_MODEL_REASONING;
  });
  it("routes classification and short extraction to haiku, the rest to sonnet", () => {
    expect(tierForTask("classify")).toBe("fast");
    expect(tierForTask("extract_fields")).toBe("fast");
    expect(tierForTask("write_document")).toBe("reasoning");
    expect(modelForTask("classify")).toBe("claude-haiku-4-5");
    expect(modelForTask("assess")).toBe("claude-sonnet-4-6");
  });
  it("respects env overrides", () => {
    process.env.AI_MODEL_REASONING = "claude-sonnet-5";
    expect(modelForTask("assess")).toBe("claude-sonnet-5");
  });
  it("estimates cost including cache tokens", () => {
    const cost = estimateCostUsd("claude-sonnet-4-6", { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
    expect(cost).toBe(3);
    expect(pricingFor("claude-haiku-4-5-20251001").input).toBe(1);
    expect(pricingFor("unknown-model").input).toBe(3);
  });
});
