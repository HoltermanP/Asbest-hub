import "server-only";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { organizationSettings, permits, projects } from "@/db/schema";
import { remindersDue } from "./deadlines";
import { emailLayout, sendEmail } from "./email";
import { formatDate } from "./format";
import { PERMIT_TYPE_LABELS } from "./labels";
import { approverEmails } from "./organization";

/**
 * Sends reminder e-mails for permit deadlines that are due today (per configured
 * lead days). Idempotent per (permit, lead-days) via permits.remindersSent.
 */
export async function sendPermitReminders(today = new Date()): Promise<{ checked: number; sent: number }> {
  const rows = await db
    .select({ permit: permits, project: projects })
    .from(permits)
    .innerJoin(projects, eq(projects.id, permits.projectId))
    .where(and(isNotNull(permits.deadline), inArray(permits.status, ["voorgesteld", "voorbereiden"])));
  let sent = 0;
  const emailCache = new Map<string, string[]>();
  for (const { permit, project } of rows) {
    const due = remindersDue(new Date(permit.deadline!), permit.reminderDaysBefore, permit.remindersSent, today);
    if (due.length === 0) continue;
    let recipients = emailCache.get(permit.organizationId);
    if (!recipients) {
      recipients = await approverEmails(permit.organizationId);
      if (recipients.length === 0) {
        const settings = await db.query.organizationSettings.findFirst({ where: eq(organizationSettings.organizationId, permit.organizationId) });
        if (settings?.notificationEmail) recipients = [settings.notificationEmail];
      }
      emailCache.set(permit.organizationId, recipients);
    }
    const label = PERMIT_TYPE_LABELS[permit.type] ?? permit.type;
    for (const d of due) {
      if (recipients.length > 0) {
        await sendEmail({
          orgId: permit.organizationId,
          actor: { kind: "system", source: "cron:reminders" },
          to: recipients,
          subject: `Herinnering: ${label} voor ${project.projectNumber} uiterlijk ${formatDate(permit.deadline)}`,
          html: emailLayout(
            `Termijn ${label}`,
            `<p>Voor project <strong>${project.name}</strong> (${project.projectNumber}) moet de ${label} uiterlijk op <strong>${formatDate(permit.deadline)}</strong> zijn ingediend bij ${permit.authority}.</p><p>Dit is de herinnering ${d.daysBefore} dagen vooraf. Status: ${permit.status}.</p>`,
            `${process.env.APP_URL ?? ""}/projecten/${project.id}/vergunningen`,
            "Open meldingen",
          ),
          kind: "permit_reminder",
          entityType: "permit",
          entityId: permit.id,
        });
        sent++;
      }
      await db
        .update(permits)
        .set({ remindersSent: [...permit.remindersSent, String(d.daysBefore)] })
        .where(eq(permits.id, permit.id));
      permit.remindersSent = [...permit.remindersSent, String(d.daysBefore)];
    }
  }
  return { checked: rows.length, sent };
}
