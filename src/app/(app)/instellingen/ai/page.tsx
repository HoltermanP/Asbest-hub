import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { ActionForm } from "@/components/shared/action-form";
import { SelectField } from "@/components/shared/form-fields";
import { KeyValue, Section } from "@/components/shared/page-header";
import { SubmitButton } from "@/components/shared/submit-button";
import { updateAiSettingsAction } from "@/actions/settings";
import { requirePermission } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { getOrganizationSettings } from "@/lib/organization";
import { can } from "@/lib/permissions";
import { DEFAULT_MODELS } from "@/ai/router";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const ctx = await requirePermission("settings:read");
  const s = await getOrganizationSettings(ctx.orgId);
  const [usage] = await db
    .select({ calls: sql<number>`count(*)`, cost: sql<string>`coalesce(sum(${auditLog.aiCostUsd}), 0)`, input: sql<number>`coalesce(sum(${auditLog.aiInputTokens}), 0)`, output: sql<number>`coalesce(sum(${auditLog.aiOutputTokens}), 0)`, cached: sql<number>`coalesce(sum(${auditLog.aiCacheReadTokens}), 0)` })
    .from(auditLog)
    .where(eq(auditLog.organizationId, ctx.orgId));
  const recent = await db.query.auditLog.findMany({ where: eq(auditLog.organizationId, ctx.orgId), orderBy: desc(auditLog.createdAt), limit: 15 });
  return (
    <div className="space-y-4">
      <Section title="AI-instellingen" description="Modellen worden per omgeving ingesteld (AI_MODEL_REASONING, AI_MODEL_FAST). Elk AI-resultaat is een voorstel; niets wordt definitief zonder menselijke accordering.">
        <ActionForm action={updateAiSettingsAction} className="grid gap-4 md:grid-cols-2" successMessage="AI-instellingen opgeslagen">
          <SelectField label="AI-advies voor beoordelaars zichtbaar" name="aiAdviceBeforeOwnScore" options={[{ value: "0", label: "Na eigen score (standaard)" }, { value: "1", label: "Voor eigen score" }]} defaultValue={s.aiAdviceBeforeOwnScore ? "1" : "0"} required hint="Geldt als standaard voor nieuwe aanbestedingen; per aanbesteding instelbaar." />
          <SelectField label="Standaard scoreschaal" name="defaultScoreScale" options={[{ value: "10", label: "0-10" }, { value: "100", label: "0-100" }]} defaultValue={String(s.defaultScoreScale)} required />
          <div className="md:col-span-2">{can(ctx.role, "settings:write") ? <SubmitButton pendingText="Opslaan...">Opslaan</SubmitButton> : null}</div>
        </ActionForm>
        <div className="mt-4">
          <KeyValue items={[{ label: "Redeneer-/schrijfmodel", value: <span className="font-mono">{process.env.AI_MODEL_REASONING ?? DEFAULT_MODELS.reasoning}</span> }, { label: "Classificatie-/extractiemodel", value: <span className="font-mono">{process.env.AI_MODEL_FAST ?? DEFAULT_MODELS.fast}</span> }, { label: "Embeddings", value: <span className="font-mono">{process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-large"}</span> }]} />
        </div>
      </Section>
      <Section title="Verbruik en kosten (totaal)">
        <KeyValue items={[{ label: "Gelogde acties", value: <span className="font-mono">{usage?.calls ?? 0}</span> }, { label: "Invoertokens", value: <span className="font-mono">{Number(usage?.input ?? 0).toLocaleString("nl-NL")}</span> }, { label: "Uitvoertokens", value: <span className="font-mono">{Number(usage?.output ?? 0).toLocaleString("nl-NL")}</span> }, { label: "Cache-lezingen", value: <span className="font-mono">{Number(usage?.cached ?? 0).toLocaleString("nl-NL")}</span> }, { label: "Geschatte kosten", value: <span className="font-mono">$ {Number(usage?.cost ?? 0).toFixed(2)}</span> }]} />
      </Section>
      <Section title="Recente audittrail">
        <ul className="divide-y text-xs">
          {recent.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span><span className="font-mono">{r.action}</span> <span className="text-muted-foreground">{r.actorType}:{r.actorId.slice(0, 18)}</span></span>
              <span className="font-mono text-muted-foreground">{r.aiModel ? `${r.aiModel} | ${r.aiInputTokens ?? 0}/${r.aiOutputTokens ?? 0} tok | $${Number(r.aiCostUsd ?? 0).toFixed(4)} | ` : ""}{formatDateTime(r.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
