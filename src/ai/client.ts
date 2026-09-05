import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createHash } from "node:crypto";
import type { z } from "zod";
import { audit } from "@/lib/audit";
import type { Actor } from "@/lib/guards";
import { estimateCostUsd, modelForTask, type TaskType } from "./router";
import { GLOBAL_RULES } from "./prompts";
import { toStrictToolSchema } from "./schema-utils";

let anthropic: Anthropic | null = null;
let openai: OpenAI | null = null;

export function anthropicClient(): Anthropic {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY ontbreekt");
    anthropic = new Anthropic({ maxRetries: 3, timeout: 10 * 60 * 1000 });
  }
  return anthropic;
}

export function openaiClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY ontbreekt");
    openai = new OpenAI({ maxRetries: 3 });
  }
  return openai;
}

export interface AiCallContext {
  orgId: string;
  actor: Actor;
  entityType?: string;
  entityId?: string;
}

export interface StructuredCall<T> {
  task: TaskType;
  agent: string;
  systemPrompt: string;
  /** Knowledge-base or document context. Cached separately from the system prompt. */
  context?: string;
  userMessage: string;
  schema: z.ZodType<T>;
  toolName: string;
  toolDescription: string;
  maxTokens?: number;
  ctx: AiCallContext;
  /** Optional documents (PDF) passed as base64 document blocks. */
  pdfDocuments?: Array<{ title: string; base64: string }>;
}

export interface StructuredResult<T> {
  data: T;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };
  costUsd: number;
  durationMs: number;
}

function hashPrompt(parts: string[]): string {
  return createHash("sha256").update(parts.join("\n---\n")).digest("hex").slice(0, 32);
}

/**
 * Single structured call: system prompt + context (both prompt-cached) + user
 * message -> forced tool call validated with zod. Never parses free JSON.
 * Retries once with the validation error when the tool input does not match the schema.
 */
export async function generateStructured<T>(call: StructuredCall<T>): Promise<StructuredResult<T>> {
  const client = anthropicClient();
  const model = modelForTask(call.task);
  const started = Date.now();
  const inputSchema = toStrictToolSchema(call.schema);

  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: `${GLOBAL_RULES}\n\n${call.systemPrompt}`, cache_control: { type: "ephemeral" } },
  ];
  if (call.context && call.context.trim().length > 0) {
    system.push({ type: "text", text: `Context en bronnen:\n\n${call.context}`, cache_control: { type: "ephemeral" } });
  }

  const userContent: Anthropic.ContentBlockParam[] = [];
  for (const doc of call.pdfDocuments ?? []) {
    userContent.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: doc.base64 },
      title: doc.title,
      citations: { enabled: false },
    });
  }
  userContent.push({ type: "text", text: call.userMessage });

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userContent }];
  const tool: Anthropic.Tool = {
    name: call.toolName,
    description: call.toolDescription,
    strict: true,
    input_schema: inputSchema as Anthropic.Tool.InputSchema,
  };

  const totals = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.create({
      model,
      max_tokens: call.maxTokens ?? 16000,
      system,
      messages,
      tools: [tool],
      tool_choice: { type: "tool", name: call.toolName },
    });
    totals.inputTokens += response.usage.input_tokens;
    totals.outputTokens += response.usage.output_tokens;
    totals.cacheReadTokens += response.usage.cache_read_input_tokens ?? 0;
    totals.cacheWriteTokens += response.usage.cache_creation_input_tokens ?? 0;

    if (response.stop_reason === "refusal") {
      lastError = "Model weigerde het verzoek";
      break;
    }
    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) {
      lastError = "Geen gestructureerde output ontvangen";
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: `Gebruik de tool ${call.toolName} om je antwoord te geven.` });
      continue;
    }
    const parsed = call.schema.safeParse(toolUse.input);
    if (parsed.success) {
      const durationMs = Date.now() - started;
      const costUsd = estimateCostUsd(model, totals);
      await audit({
        orgId: call.ctx.orgId,
        actor: call.ctx.actor,
        action: `ai.${call.agent}`,
        entityType: call.ctx.entityType,
        entityId: call.ctx.entityId,
        details: { task: call.task, attempt: attempt + 1 },
        ai: {
          model,
          promptHash: hashPrompt([call.systemPrompt, call.context ?? "", call.userMessage]),
          inputTokens: totals.inputTokens,
          outputTokens: totals.outputTokens,
          cacheReadTokens: totals.cacheReadTokens,
          cacheWriteTokens: totals.cacheWriteTokens,
          costUsd,
          durationMs,
        },
      });
      return { data: parsed.data, model, usage: totals, costUsd, durationMs };
    }
    lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUse.id,
          is_error: true,
          content: `De output voldoet niet aan het schema: ${lastError}. Roep de tool opnieuw aan met gecorrigeerde waarden.`,
        },
      ],
    });
  }

  await audit({
    orgId: call.ctx.orgId,
    actor: call.ctx.actor,
    action: `ai.${call.agent}.failed`,
    entityType: call.ctx.entityType,
    entityId: call.ctx.entityId,
    details: { error: lastError },
    ai: {
      model,
      promptHash: hashPrompt([call.systemPrompt, call.context ?? "", call.userMessage]),
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      cacheReadTokens: totals.cacheReadTokens,
      cacheWriteTokens: totals.cacheWriteTokens,
      costUsd: estimateCostUsd(model, totals),
      durationMs: Date.now() - started,
    },
  });
  throw new Error(`AI-aanroep mislukt (${call.agent}): ${lastError ?? "onbekende fout"}`);
}
