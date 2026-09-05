import "server-only";
import { awardAdvisor } from "./award-advisor";
import { bidAssessor } from "./bid-assessor";
import { bidChecker } from "./bid-checker";
import { calculatorAgent } from "./calculator";
import { documentAuthor } from "./document-author";
import { investigationExtractor } from "./investigation-extractor";
import { permitAdvisor } from "./permit-advisor";
import { nviResponder } from "./nvi-responder";
import { plannerAgent } from "./planner";
import { sessionSynthesizer } from "./session-synthesizer";
import { tenderAuthor } from "./tender-author";
import { tenderDesigner } from "./tender-designer";
import type { AgentDefinition } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyAgent = AgentDefinition<any, any>;

const list: AnyAgent[] = [investigationExtractor, permitAdvisor, documentAuthor, calculatorAgent, plannerAgent, tenderDesigner, tenderAuthor, nviResponder, bidChecker, bidAssessor, sessionSynthesizer, awardAdvisor];

/** Registry of all agents, keyed by agent name. */
export const AGENTS: Record<string, AnyAgent> = Object.fromEntries(list.map((a) => [a.name, a]));
