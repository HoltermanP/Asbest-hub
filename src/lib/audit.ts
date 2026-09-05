import "server-only";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import type { Actor } from "./guards";

export interface AuditEntry {
  orgId: string;
  actor: Actor;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ai?: {
    model: string;
    promptHash: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    costUsd: number;
    durationMs: number;
  };
}

function actorId(actor: Actor): string {
  switch (actor.kind) {
    case "human":
      return actor.userId;
    case "ai":
      return `ai:${actor.agent}`;
    case "system":
      return `system:${actor.source}`;
  }
}

export async function audit(entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    organizationId: entry.orgId,
    actorId: actorId(entry.actor),
    actorType: entry.actor.kind,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    details: entry.details ?? {},
    aiModel: entry.ai?.model ?? null,
    aiPromptHash: entry.ai?.promptHash ?? null,
    aiInputTokens: entry.ai?.inputTokens ?? null,
    aiOutputTokens: entry.ai?.outputTokens ?? null,
    aiCacheReadTokens: entry.ai?.cacheReadTokens ?? null,
    aiCacheWriteTokens: entry.ai?.cacheWriteTokens ?? null,
    aiCostUsd: entry.ai ? entry.ai.costUsd.toFixed(6) : null,
    aiDurationMs: entry.ai?.durationMs ?? null,
  });
}
