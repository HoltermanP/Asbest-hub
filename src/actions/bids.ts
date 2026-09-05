"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/db";
import { bidDocuments, bids, tenders } from "@/db/schema";
import { runAction } from "@/lib/action-result";
import { requestApproval } from "@/lib/approvals";
import { audit } from "@/lib/audit";
import { assertTenderAccess, requirePermission } from "@/lib/auth";
import { classifyBidDocument, ingestBidDocument } from "@/lib/bid-ingest";
import { assertHumanActor } from "@/lib/guards";
import { enqueueJob } from "@/lib/jobs";
import { approverEmails } from "@/lib/organization";
import { NotFoundError, ValidationError } from "@/lib/permissions";
import { assertUploadSize, putFile, virusScanner } from "@/lib/storage";
import { readPriceSheet } from "@/lib/text-extract";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function loadBid(orgId: string, bidId: string) {
  const b = await db.query.bids.findFirst({ where: and(eq(bids.id, bidId), eq(bids.organizationId, orgId)) });
  if (!b) throw new NotFoundError("Inschrijving niet gevonden");
  return b;
}

/** Registers a bid with one or more files; text extraction and embedding run after the response. */
export async function createBidAction(tenderId: string, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const tender = await db.query.tenders.findFirst({ where: and(eq(tenders.id, tenderId), eq(tenders.organizationId, ctx.orgId)) });
    if (!tender) throw new NotFoundError("Aanbesteding niet gevonden");
    const bidderName = str(fd, "bidderName");
    if (!bidderName) throw new ValidationError("Naam inschrijver is verplicht");
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) throw new ValidationError("Minimaal één bestand (pdf, docx of xlsx) is verplicht");
    const priceInput = str(fd, "price");
    const [bid] = await db
      .insert(bids)
      .values({
        organizationId: ctx.orgId,
        createdBy: ctx.userId,
        tenderId,
        bidderName,
        bidderKvk: str(fd, "bidderKvk") || null,
        receivedAt: str(fd, "receivedAt") ? new Date(str(fd, "receivedAt")) : new Date(),
        price: priceInput ? Number(priceInput.replace(",", ".")).toFixed(2) : null,
      })
      .returning();
    if (!bid) throw new Error("Inschrijving niet aangemaakt");
    const docIds: string[] = [];
    let priceBreakdown: typeof bids.$inferInsert.priceBreakdown = null;
    for (const file of files) {
      assertUploadSize(file.size);
      const buf = Buffer.from(await file.arrayBuffer());
      const scan = await virusScanner.scan(buf, file.name);
      if (!scan.clean) throw new ValidationError(`Bestand ${file.name} geweigerd door virusscanner`);
      const stored = await putFile(`orgs/${ctx.orgId}/bids/${bid.id}/${Date.now()}-${file.name}`, buf, file.type || "application/octet-stream");
      const [doc] = await db
        .insert(bidDocuments)
        .values({ organizationId: ctx.orgId, createdBy: ctx.userId, bidId: bid.id, fileName: file.name, fileUrl: stored.url, mimeType: file.type || "application/octet-stream", sizeBytes: file.size, documentKind: classifyBidDocument(file.name, "") })
        .returning();
      if (doc) docIds.push(doc.id);
      if (file.name.toLowerCase().endsWith(".xlsx") && !priceBreakdown) {
        try {
          const lines = await readPriceSheet(buf);
          if (lines.length) priceBreakdown = lines;
        } catch {
          /* not a price sheet */
        }
      }
    }
    if (priceBreakdown) {
      const total = priceBreakdown.reduce((s, l) => s + l.totaal, 0);
      await db.update(bids).set({ priceBreakdown, price: bid.price ?? total.toFixed(2) }).where(eq(bids.id, bid.id));
    }
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "bid.created", entityType: "bid", entityId: bid.id, details: { files: files.length } });
    after(async () => {
      for (const id of docIds) {
        try {
          await ingestBidDocument(id, { orgId: ctx.orgId, actor: { kind: "system", source: "bid-ingest" } });
        } catch (err) {
          console.error("[bid-ingest]", err);
        }
      }
    });
    revalidatePath(`/aanbestedingen/${tenderId}/inschrijvingen`);
    return { id: bid.id };
  });
}

export async function reingestBidAction(bidId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const bid = await loadBid(ctx.orgId, bidId);
    const docs = await db.query.bidDocuments.findMany({ where: eq(bidDocuments.bidId, bidId), columns: { id: true } });
    for (const d of docs) await ingestBidDocument(d.id, { orgId: ctx.orgId, actor: ctx.actor });
    revalidatePath(`/aanbestedingen/${bid.tenderId}/inschrijvingen`);
    return { documents: docs.length };
  });
}

export async function runBidCheckAction(bidId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("ai:run");
    const bid = await loadBid(ctx.orgId, bidId);
    if (!bid.textExtracted) throw new ValidationError("Tekstextractie is nog bezig; probeer het zo opnieuw");
    const job = await enqueueJob({ ctx, agent: "bid-checker", input: { bidId, requestedByName: ctx.name }, entityType: "bid", entityId: bidId });
    await db.update(bids).set({ checkJobId: job.id }).where(eq(bids.id, bidId));
    revalidatePath(`/aanbestedingen/${bid.tenderId}/inschrijvingen`);
    return { jobId: job.id };
  });
}

export async function runAllBidChecksAction(tenderId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("ai:run");
    await assertTenderAccess(ctx, tenderId);
    const rows = await db.query.bids.findMany({ where: and(eq(bids.tenderId, tenderId), eq(bids.textExtracted, true)) });
    const jobs: string[] = [];
    for (const b of rows.filter((r) => r.status !== "uitgesloten" && r.status !== "ingetrokken")) {
      const job = await enqueueJob({ ctx, agent: "bid-checker", input: { bidId: b.id, requestedByName: ctx.name }, entityType: "bid", entityId: b.id });
      await db.update(bids).set({ checkJobId: job.id }).where(eq(bids.id, b.id));
      jobs.push(job.id);
    }
    revalidatePath(`/aanbestedingen/${tenderId}/inschrijvingen`);
    return { jobs: jobs.length };
  });
}

/** Human marks a bid as valid after reviewing the findings. */
export async function markBidValidAction(bidId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const bid = await loadBid(ctx.orgId, bidId);
    await db.update(bids).set({ status: "geldig" }).where(eq(bids.id, bidId));
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "bid.valid", entityType: "bid", entityId: bidId });
    revalidatePath(`/aanbestedingen/${bid.tenderId}/inschrijvingen`);
    return { ok: true };
  });
}

/**
 * Proposes exclusion. The exclusion itself becomes effective only after a human
 * with approval rights approves the request (bid_exclusion handler). Never callable by AI.
 */
export async function proposeExclusionAction(bidId: string, reason: string) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    assertHumanActor(ctx.actor, "bid:exclude");
    if (!reason || reason.trim().length < 10) throw new ValidationError("Geef een onderbouwde reden (minimaal 10 tekens)");
    const bid = await loadBid(ctx.orgId, bidId);
    const tender = await db.query.tenders.findFirst({ where: eq(tenders.id, bid.tenderId) });
    await db.update(bids).set({ exclusionReason: reason.trim() }).where(eq(bids.id, bidId));
    const approval = await requestApproval({
      ctx,
      entityType: "bid_exclusion",
      entityId: bidId,
      label: `Uitsluiting ${bid.bidderName} (${tender?.referenceNumber ?? ""})`,
      projectId: tender?.projectId ?? null,
      tenderId: bid.tenderId,
      snapshot: { reden: reason.trim(), bevindingen: bid.checkFindings.filter((f) => f.ernst === "kritiek").map((f) => f.bevinding) },
      notifyEmails: await approverEmails(ctx.orgId),
    });
    revalidatePath(`/aanbestedingen/${bid.tenderId}/inschrijvingen`);
    return { approvalId: approval.id };
  });
}

export async function withdrawBidAction(bidId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const bid = await loadBid(ctx.orgId, bidId);
    await db.update(bids).set({ status: "ingetrokken" }).where(eq(bids.id, bidId));
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "bid.withdrawn", entityType: "bid", entityId: bidId });
    revalidatePath(`/aanbestedingen/${bid.tenderId}/inschrijvingen`);
    return { ok: true };
  });
}

export async function deleteBidAction(bidId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const bid = await loadBid(ctx.orgId, bidId);
    await db.delete(bids).where(eq(bids.id, bidId));
    await audit({ orgId: ctx.orgId, actor: ctx.actor, action: "bid.deleted", entityType: "bid", entityId: bidId });
    revalidatePath(`/aanbestedingen/${bid.tenderId}/inschrijvingen`);
    return { ok: true };
  });
}

export async function updateBidPriceAction(bidId: string, fd: FormData) {
  return runAction(async () => {
    const ctx = await requirePermission("tender:write");
    const bid = await loadBid(ctx.orgId, bidId);
    const price = Number(str(fd, "price").replace(",", "."));
    if (!Number.isFinite(price) || price <= 0) throw new ValidationError("Ongeldige prijs");
    await db.update(bids).set({ price: price.toFixed(2), bidderKvk: str(fd, "bidderKvk") || bid.bidderKvk }).where(eq(bids.id, bidId));
    revalidatePath(`/aanbestedingen/${bid.tenderId}/inschrijvingen`);
    return { ok: true };
  });
}
