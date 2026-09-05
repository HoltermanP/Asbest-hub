import "server-only";
import { Resend } from "resend";
import { db } from "@/db";
import { notificationLog } from "@/db/schema";
import { assertHumanActor, type Actor } from "./guards";
import { isProduction } from "./env";

export interface EmailRequest {
  orgId: string;
  actor: Actor;
  to: string | string[];
  subject: string;
  html: string;
  kind: string;
  entityType?: string;
  entityId?: string;
}

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

/**
 * Sends an e-mail through Resend and logs the attempt. Sending is a protected
 * action: only a human or system actor (cron reminders) may trigger it, never an AI agent.
 */
export async function sendEmail(req: EmailRequest): Promise<{ status: "verzonden" | "overgeslagen" | "fout"; id: string | null }> {
  if (req.actor.kind === "ai") assertHumanActor(req.actor, "notification:send");
  const recipients = Array.isArray(req.to) ? req.to : [req.to];
  const sentBy = req.actor.kind === "human" ? req.actor.userId : req.actor.kind === "system" ? `system:${req.actor.source}` : "ai";
  const resend = client();
  const from = process.env.EMAIL_FROM ?? "AsbestHub <noreply@example.com>";

  if (!resend) {
    if (isProduction()) throw new Error("RESEND_API_KEY ontbreekt in productie");
    await db.insert(notificationLog).values({
      organizationId: req.orgId,
      kind: req.kind,
      recipient: recipients.join(", "),
      subject: req.subject,
      entityType: req.entityType ?? null,
      entityId: req.entityId ?? null,
      sentBy,
      status: "overgeslagen",
      error: "RESEND_API_KEY niet geconfigureerd (development)",
    });
    return { status: "overgeslagen", id: null };
  }

  try {
    const result = await resend.emails.send({ from, to: recipients, subject: req.subject, html: req.html });
    if (result.error) throw new Error(result.error.message);
    await db.insert(notificationLog).values({
      organizationId: req.orgId,
      kind: req.kind,
      recipient: recipients.join(", "),
      subject: req.subject,
      entityType: req.entityType ?? null,
      entityId: req.entityId ?? null,
      sentBy,
      providerId: result.data?.id ?? null,
      status: "verzonden",
    });
    return { status: "verzonden", id: result.data?.id ?? null };
  } catch (err) {
    await db.insert(notificationLog).values({
      organizationId: req.orgId,
      kind: req.kind,
      recipient: recipients.join(", "),
      subject: req.subject,
      entityType: req.entityType ?? null,
      entityId: req.entityId ?? null,
      sentBy,
      status: "fout",
      error: err instanceof Error ? err.message : String(err),
    });
    return { status: "fout", id: null };
  }
}

export function emailLayout(title: string, bodyHtml: string, ctaUrl?: string, ctaLabel?: string): string {
  const cta = ctaUrl
    ? `<p style="margin:24px 0"><a href="${ctaUrl}" style="background:#2D6FE8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">${ctaLabel ?? "Openen in AsbestHub"}</a></p>`
    : "";
  return `<!doctype html><html lang="nl"><body style="font-family:Inter,Arial,sans-serif;color:#0D1428;background:#f6f7f9;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb">
    <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
    ${bodyHtml}
    ${cta}
    <p style="font-size:12px;color:#6b7280;margin-top:32px">Dit bericht is automatisch verzonden door AsbestHub.</p>
  </div></body></html>`;
}
