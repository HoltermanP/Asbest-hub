/**
 * Hard human-in-the-loop rules. These are enforced in code, not in prompts.
 * An AI actor can never perform a protected action; the functions that do so
 * require an Actor argument and call assertHumanActor first.
 */
export type Actor =
  | { kind: "human"; userId: string; name: string }
  | { kind: "ai"; agent: string }
  | { kind: "system"; source: string };

export const PROTECTED_ACTIONS = [
  "bid:exclude",
  "score:finalize",
  "document:publish",
  "notification:send",
  "approval:decide",
  "permit:submit",
] as const;
export type ProtectedAction = (typeof PROTECTED_ACTIONS)[number];

export const PROTECTED_ACTION_LABELS: Record<ProtectedAction, string> = {
  "bid:exclude": "een inschrijver uitsluiten",
  "score:finalize": "een score definitief maken",
  "document:publish": "een document publiceren of definitief maken",
  "notification:send": "een melding of e-mail versturen",
  "approval:decide": "een accordering goed- of afkeuren",
  "permit:submit": "een melding of vergunningaanvraag indienen",
};

export class HumanRequiredError extends Error {
  readonly status = 403;
  constructor(action: ProtectedAction, actor: Actor) {
    super(
      `Alleen een mens mag ${PROTECTED_ACTION_LABELS[action]}. Actor van type "${actor.kind}" is geweigerd.`,
    );
    this.name = "HumanRequiredError";
  }
}

export function isHumanActor(actor: Actor): actor is Extract<Actor, { kind: "human" }> {
  return actor.kind === "human" && typeof actor.userId === "string" && actor.userId.length > 0;
}

export function assertHumanActor(actor: Actor, action: ProtectedAction): asserts actor is Extract<Actor, { kind: "human" }> {
  if (!isHumanActor(actor)) throw new HumanRequiredError(action, actor);
}

export function isProtectedAction(action: string): action is ProtectedAction {
  return (PROTECTED_ACTIONS as readonly string[]).includes(action);
}
