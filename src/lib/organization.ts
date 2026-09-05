import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationSettings, type ProcurementPolicy } from "@/db/schema";
import type { AppContext } from "./auth";
import { DEFAULT_PROCUREMENT_POLICY } from "./thresholds";

/** Creates default settings for an organization on first use. */
export async function ensureOrganizationSettings(ctx: AppContext) {
  const existing = await db.query.organizationSettings.findFirst({ where: eq(organizationSettings.organizationId, ctx.orgId) });
  if (existing) return existing;
  let name = ctx.orgSlug ?? "Organisatie";
  try {
    const client = await clerkClient();
    const org = await client.organizations.getOrganization({ organizationId: ctx.orgId });
    name = org.name;
  } catch {
    /* Clerk lookup is best-effort; slug fallback is fine. */
  }
  const [row] = await db
    .insert(organizationSettings)
    .values({ organizationId: ctx.orgId, name, procurementPolicy: DEFAULT_PROCUREMENT_POLICY })
    .onConflictDoNothing()
    .returning();
  return row ?? (await db.query.organizationSettings.findFirst({ where: eq(organizationSettings.organizationId, ctx.orgId) }))!;
}

export async function getOrganizationSettings(orgId: string) {
  const row = await db.query.organizationSettings.findFirst({ where: eq(organizationSettings.organizationId, orgId) });
  if (!row) throw new Error("Organisatie-instellingen ontbreken");
  return row;
}

export async function getProcurementPolicy(orgId: string): Promise<ProcurementPolicy> {
  const s = await getOrganizationSettings(orgId);
  return s.procurementPolicy;
}

/** E-mail addresses of members with an approving role (admin, projectleider), for notifications. */
export async function approverEmails(orgId: string): Promise<string[]> {
  try {
    const client = await clerkClient();
    const list = await client.organizations.getOrganizationMembershipList({ organizationId: orgId, limit: 100 });
    const emails: string[] = [];
    for (const m of list.data) {
      const role = m.role.replace(/^org:/, "");
      if (role !== "admin" && role !== "projectleider") continue;
      const userId = m.publicUserData?.userId;
      if (!userId) continue;
      const user = await client.users.getUser(userId);
      const email = user.primaryEmailAddress?.emailAddress;
      if (email) emails.push(email);
    }
    return emails;
  } catch {
    return [];
  }
}
