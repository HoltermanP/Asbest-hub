import type { z } from "zod";
import type { Actor } from "@/lib/guards";

export interface AgentRunContext {
  jobId: string;
  orgId: string;
  actor: Actor;
  /** The human who requested the job; used for audit and for "requested by" fields. */
  requestedBy: string;
  progress: (percent: number, message: string) => Promise<void>;
}

export interface AgentDefinition<I, O> {
  name: string;
  description: string;
  input: z.ZodType<I>;
  output: z.ZodType<O>;
  /** Long-running agents (> 20 s) run via the queue; short ones inline. */
  longRunning: boolean;
  run: (input: I, ctx: AgentRunContext) => Promise<O>;
}

export function defineAgent<I, O>(def: AgentDefinition<I, O>): AgentDefinition<I, O> {
  return def;
}
