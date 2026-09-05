import "server-only";
import type { AiSource } from "@/db/schema";
import type { Requester } from "@/lib/approvals";
import type { AgentRunContext } from "./types";

/** Requester used by agents for approval requests: the human who started the job. */
export function requesterFromJob(ctx: AgentRunContext, requestedByName: string): Requester {
  return {
    orgId: ctx.orgId,
    userId: ctx.requestedBy,
    name: requestedByName,
    email: "",
    actor: { kind: "human", userId: ctx.requestedBy, name: requestedByName },
  };
}

export function mergeSources(...lists: AiSource[][]): AiSource[] {
  const seen = new Set<string>();
  const out: AiSource[] = [];
  for (const list of lists) {
    for (const s of list) {
      const key = `${s.kind}:${s.id}:${s.page ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

export const MAX_PDF_BYTES_FOR_MODEL = 25 * 1024 * 1024;
