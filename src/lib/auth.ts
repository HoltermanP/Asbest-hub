import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { tenderAssessors, tenders } from "@/db/schema";
import type { Actor } from "./guards";
import { can, ForbiddenError, isTenderScopedRole, type Permission, type Role, roleFromClerk, UnauthorizedError } from "./permissions";

export interface AppContext {
  userId: string;
  orgId: string;
  orgSlug: string | null;
  role: Role;
  name: string;
  email: string;
  actor: Extract<Actor, { kind: "human" }>;
}

export interface AuthState {
  userId: string | null;
  orgId: string | null;
  role: Role;
}

/** Non-throwing variant for layouts. */
export async function getAuthState(): Promise<AuthState> {
  const a = await auth();
  return { userId: a.userId ?? null, orgId: a.orgId ?? null, role: roleFromClerk(a.orgRole) };
}

/** Full context for server actions and route handlers. Throws when not signed in or no active organization. */
export async function getContext(): Promise<AppContext> {
  const a = await auth();
  if (!a.userId) throw new UnauthorizedError();
  if (!a.orgId) throw new UnauthorizedError("Geen actieve organisatie geselecteerd");
  const user = await currentUser();
  const name =
    user?.fullName ?? [user?.firstName, user?.lastName].filter(Boolean).join(" ") ?? user?.username ?? "Onbekende gebruiker";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const role = roleFromClerk(a.orgRole);
  return {
    userId: a.userId,
    orgId: a.orgId,
    orgSlug: a.orgSlug ?? null,
    role,
    name: name || "Onbekende gebruiker",
    email,
    actor: { kind: "human", userId: a.userId, name: name || "Onbekende gebruiker" },
  };
}

export async function requirePermission(permission: Permission): Promise<AppContext> {
  const ctx = await getContext();
  if (!can(ctx.role, permission)) throw new ForbiddenError(`Rol "${ctx.role}" heeft geen recht "${permission}"`);
  return ctx;
}

export function assertPermission(ctx: AppContext, permission: Permission): void {
  if (!can(ctx.role, permission)) throw new ForbiddenError(`Rol "${ctx.role}" heeft geen recht "${permission}"`);
}

/**
 * Asserts the user may see a tender. Beoordelaars and externen only see tenders
 * they are assigned to via tender_assessors.
 */
export async function assertTenderAccess(ctx: AppContext, tenderId: string): Promise<void> {
  const tender = await db.query.tenders.findFirst({
    where: and(eq(tenders.id, tenderId), eq(tenders.organizationId, ctx.orgId)),
    columns: { id: true },
  });
  if (!tender) throw new ForbiddenError("Aanbesteding niet gevonden in deze organisatie");
  if (!isTenderScopedRole(ctx.role)) return;
  const assignment = await db.query.tenderAssessors.findFirst({
    where: and(
      eq(tenderAssessors.tenderId, tenderId),
      or(eq(tenderAssessors.userId, ctx.userId), eq(tenderAssessors.email, ctx.email)),
    ),
    columns: { id: true },
  });
  if (!assignment) throw new ForbiddenError("U bent niet toegewezen aan deze aanbesteding");
}

/** Tender ids visible to the current user (used for list pages). Returns null when unrestricted. */
export async function visibleTenderIds(ctx: AppContext): Promise<string[] | null> {
  if (!isTenderScopedRole(ctx.role)) return null;
  const rows = await db
    .select({ tenderId: tenderAssessors.tenderId })
    .from(tenderAssessors)
    .where(
      and(
        eq(tenderAssessors.organizationId, ctx.orgId),
        or(eq(tenderAssessors.userId, ctx.userId), eq(tenderAssessors.email, ctx.email)),
      ),
    );
  return rows.map((r) => r.tenderId);
}
