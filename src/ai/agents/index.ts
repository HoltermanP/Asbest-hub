import "server-only";
import type { AgentDefinition } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyAgent = AgentDefinition<any, any>;

/** Registry of all agents, keyed by agent name. Populated by each agent module. */
export const AGENTS: Record<string, AnyAgent> = {};

export function registerAgent(agent: AnyAgent): void {
  AGENTS[agent.name] = agent;
}
