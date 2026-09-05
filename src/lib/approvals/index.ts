import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { approvals } from "@/db/schema";
import { audit } from "../audit";
import type { AppContext } from "../auth";
import type { Actor } from "../guards";
import { emailLayout, sendEmail } from "../email";
import { assertHumanActor } from "../guards";
import { can, ForbiddenError, NotFoundError, ValidationError } from "../permissions";
import { ENTITY_HANDLERS } from "./handlers";
import { APPROVAL_ENTITY_LABELS, type ApprovalDecision, type ApprovalEntityType, validateDecision } from "./types";

export * from "./types";

/** Minimal requester info; AppContext satisfies this, and agents build it from the job. */
export interface Requester {
  orgId: string;
  userId: string;
  name: string;
  email: string;
  actor: Actor;
}

export interface RequestApprovalInput {
  ctx: Requester;
  entityType: ApprovalEntityType;
  entityId: string;
  label: string;
  projectId?: string | null;
  tenderId?: string | null;
  snapshot?: Record<string, unknown>;
  assignedTo?: string | null;
  notifyEmails?: string[];
}

/** Creates an open approval request. Rejects when an open request already exists for the entity. */
export async function requestApproval(input: RequestApprovalInput) {
  const { ctx } = input;
  const existing = await db.query.approvals.findFirst({
    where: and(
      eq(approvals.organizationId, ctx.orgId),
      eq(approvals.entityType, input.entityType),
      eq(approvals.entityId, input.entityId),
      eq(approvals.status, "open"),
    ),
  });
  if (existing) throw new ValidationError("Er staat al een accorderingsverzoek open voor dit onderdeel");

  const [row] = await db
    .insert(approvals)
    .values({
      organizationId: ctx.orgId,
      createdBy: ctx.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: input.label,
      projectId: input.projectId ?? null,
      tenderId: input.tenderId ?? null,
      requestedBy: ctx.userId,
      requestedByName: ctx.name,
      assignedTo: input.assignedTo ?? null,
      snapshot: input.snapshot ?? {},
    })
    .returning();
  if (!row) throw new Error("Accorderingsverzoek kon niet worden aangemaakt");

  await ENTITY_HANDLERS[input.entityType].onRequest({
    orgId: ctx.orgId,
    entityId: input.entityId,
    userId: ctx.userId,
    userName: ctx.name,
    now: new Date(),
    comment: null,
  });

  await audit({
    orgId: ctx.orgId,
    actor: ctx.actor,
    action: "approval.requested",
    entityType: input.entityType,
    entityId: input.entityId,
    details: { approvalId: row.id, label: input.label },
  });

  const recipients = (input.notifyEmails ?? []).filter((e) => e && e !== ctx.email);
  if (recipients.length > 0) {
    const url = `${process.env.APP_URL ?? ""}/accorderingen`;
    await sendEmail({
      orgId: ctx.orgId,
      actor: ctx.actor,
      to: recipients,
      subject: `Accordering gevraagd: ${input.label}`,
      html: emailLayout(
        "Nieuw accorderingsverzoek",
        `<p>${ctx.name} vraagt accordering voor <strong>${input.label}</strong> (${APPROVAL_ENTITY_LABELS[input.entityType]}).</p>`,
        url,
        "Bekijk accorderingen",
      ),
      kind: "approval_request",
      entityType: "approval",
      entityId: row.id,
    });
    await db.update(approvals).set({ notifiedAt: new Date() }).where(eq(approvals.id, row.id));
  }
  return row;
}

/**
 * Like requestApproval, but when an open request already exists for the entity
 * (e.g. a new AI version of a document under review) the open request is kept
 * and its label/snapshot refreshed instead of failing.
 */
export async function requestApprovalOrReuse(input: RequestApprovalInput) {
  const existing = await db.query.approvals.findFirst({
    where: and(
      eq(approvals.organizationId, input.ctx.orgId),
      eq(approvals.entityType, input.entityType),
      eq(approvals.entityId, input.entityId),
      eq(approvals.status, "open"),
    ),
  });
  if (!existing) return requestApproval(input);
  const [updated] = await db
    .update(approvals)
    .set({ entityLabel: input.label, snapshot: { ...existing.snapshot, ...(input.snapshot ?? {}), vervangen: true } })
    .where(eq(approvals.id, existing.id))
    .returning();
  await ENTITY_HANDLERS[input.entityType].onRequest({ orgId: input.ctx.orgId, entityId: input.entityId, userId: input.ctx.userId, userName: input.ctx.name, now: new Date(), comment: null });
  return updated ?? existing;
}

export interface DecideApprovalInput {
  ctx: AppContext;
  approvalId: string;
  decision: ApprovalDecision;
  comment?: string | null;
}

/**
 * Human decision on an approval. Only roles with "approval:decide" may call this,
 * and the actor must be human (hard rule). On approval the entity handler makes the
 * entity definitive; on rejection the entity reverts to concept with the reason stored.
 */
export async function decideApproval(input: DecideApprovalInput) {
  const { ctx } = input;
  assertHumanActor(ctx.actor, "approval:decide");
  if (!can(ctx.role, "approval:decide")) throw new ForbiddenError("Alleen projectleiders en beheerders mogen accorderen");
  const validation = validateDecision(input.decision, input.comment);
  if (!validation.ok) throw new ValidationError(validation.reason);

  const approval = await db.query.approvals.findFirst({
    where: and(eq(approvals.id, input.approvalId), eq(approvals.organizationId, ctx.orgId)),
  });
  if (!approval) throw new NotFoundError("Accorderingsverzoek niet gevonden");
  if (approval.status !== "open") throw new ValidationError("Dit verzoek is al afgehandeld");

  const now = new Date();
  const [updated] = await db
    .update(approvals)
    .set({
      status: input.decision,
      decidedBy: ctx.userId,
      decidedByName: ctx.name,
      decidedAt: now,
      comment: input.comment?.trim() || null,
    })
    .where(eq(approvals.id, approval.id))
    .returning();

  const handlerCtx = {
    orgId: ctx.orgId,
    entityId: approval.entityId,
    userId: ctx.userId,
    userName: ctx.name,
    now,
    comment: input.comment?.trim() || null,
  };
  if (input.decision === "goedgekeurd") await ENTITY_HANDLERS[approval.entityType].onApprove(handlerCtx);
  else await ENTITY_HANDLERS[approval.entityType].onReject(handlerCtx);

  await audit({
    orgId: ctx.orgId,
    actor: ctx.actor,
    action: `approval.${input.decision}`,
    entityType: approval.entityType,
    entityId: approval.entityId,
    details: { approvalId: approval.id, comment: input.comment ?? null },
  });
  return updated ?? approval;
}

/** Throws unless a goedgekeurd approval exists for the entity. Guards every transition to "definitief". */
export async function assertApproved(orgId: string, entityType: ApprovalEntityType, entityId: string): Promise<void> {
  const row = await db.query.approvals.findFirst({
    where: and(
      eq(approvals.organizationId, orgId),
      eq(approvals.entityType, entityType),
      eq(approvals.entityId, entityId),
      eq(approvals.status, "goedgekeurd"),
    ),
    columns: { id: true },
  });
  if (!row) throw new ForbiddenError("Deze status vereist een goedgekeurde accordering");
}

export async function latestApproval(orgId: string, entityType: ApprovalEntityType, entityId: string) {
  return db.query.approvals.findFirst({
    where: and(eq(approvals.organizationId, orgId), eq(approvals.entityType, entityType), eq(approvals.entityId, entityId)),
    orderBy: desc(approvals.createdAt),
  });
}

/** Latest rejection reason, used to steer the next AI iteration. */
export async function latestRejectionReason(orgId: string, entityType: ApprovalEntityType, entityId: string): Promise<string | null> {
  const row = await db.query.approvals.findFirst({
    where: and(
      eq(approvals.organizationId, orgId),
      eq(approvals.entityType, entityType),
      eq(approvals.entityId, entityId),
      eq(approvals.status, "afgewezen"),
    ),
    orderBy: desc(approvals.decidedAt),
    columns: { comment: true },
  });
  return row?.comment ?? null;
}

export async function openApprovalsForUser(ctx: AppContext) {
  const rows = await db.query.approvals.findMany({
    where: and(eq(approvals.organizationId, ctx.orgId), eq(approvals.status, "open")),
    orderBy: desc(approvals.createdAt),
  });
  if (can(ctx.role, "approval:decide")) return rows.filter((r) => !r.assignedTo || r.assignedTo === ctx.userId);
  return rows.filter((r) => r.requestedBy === ctx.userId);
}
