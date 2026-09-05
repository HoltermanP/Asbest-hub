import "server-only";
import { toFile } from "openai";
import { openaiClient } from "@/ai/client";
import { audit } from "./audit";
import type { Actor } from "./guards";

/** Transcribes an audio file (mp3/m4a/wav) with OpenAI Whisper, Dutch. */
export async function transcribeAudio(data: Buffer, fileName: string, ctx: { orgId: string; actor: Actor; entityId?: string }): Promise<string> {
  const client = openaiClient();
  const started = Date.now();
  const file = await toFile(data, fileName);
  const result = await client.audio.transcriptions.create({ file, model: "whisper-1", language: "nl", response_format: "text" });
  const text = typeof result === "string" ? result : (result as { text: string }).text;
  await audit({
    orgId: ctx.orgId,
    actor: ctx.actor,
    action: "ai.transcription",
    entityType: "assessment_session",
    entityId: ctx.entityId,
    details: { fileName, bytes: data.length },
    ai: { model: "whisper-1", promptHash: "", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: Math.round((data.length / (16_000 * 60)) * 0.006 * 100) / 100, durationMs: Date.now() - started },
  });
  return text.trim();
}
