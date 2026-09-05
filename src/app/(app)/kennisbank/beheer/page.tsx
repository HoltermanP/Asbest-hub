import { asc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeDocuments } from "@/db/schema";
import { ActionButton } from "@/components/shared/action-button";
import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField, TextField } from "@/components/shared/form-fields";
import { PageHeader, Section } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { addUrlSourceAction, deleteSourceAction, reindexSourceAction, uploadSourceAction } from "@/actions/knowledge";
import { requirePermission } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { KNOWLEDGE_SOURCES, sourceIsStale } from "@/lib/knowledge";

export const dynamic = "force-dynamic";

const CATEGORIES = ["wet", "omgevingswet", "arbo", "certificering", "lavs", "handhaving", "normen", "afval", "techniek", "aanbesteden", "overig"];

export default async function KnowledgeAdminPage() {
  const ctx = await requirePermission("knowledge:manage");
  const docs = await db.query.knowledgeDocuments.findMany({ where: or(isNull(knowledgeDocuments.organizationId), eq(knowledgeDocuments.organizationId, ctx.orgId)), orderBy: asc(knowledgeDocuments.title) });
  const missing = KNOWLEDGE_SOURCES.filter((s) => !docs.some((d) => d.sourceUrl === s.url));
  return (
    <div>
      <PageHeader title="Kennisbank beheren" breadcrumbs={[{ href: "/kennisbank", label: "Kennisbank" }, { label: "Beheer" }]} description="Voeg bronnen toe (URL of upload) en herindexeer. Gedeelde publieke bronnen worden met pnpm knowledge:import geladen; bronnen ouder dan 12 maanden krijgen een waarschuwing." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Bron toevoegen via URL">
          <ActionForm action={addUrlSourceAction} className="space-y-3" successMessage="Bron geïndexeerd">
            <TextField label="Titel" name="title" required />
            <TextField label="URL" name="url" type="url" required />
            <SelectField label="Categorie" name="category" options={CATEGORIES.map((c) => ({ value: c, label: c }))} defaultValue="overig" required />
            <SubmitButton pendingText="Ophalen en indexeren...">Toevoegen</SubmitButton>
          </ActionForm>
        </Section>
        <Section title="Bron uploaden (pdf, docx, txt)">
          <ActionForm action={uploadSourceAction} className="space-y-3" successMessage="Bron geïndexeerd">
            <TextField label="Titel" name="title" required />
            <SelectField label="Categorie" name="category" options={CATEGORIES.map((c) => ({ value: c, label: c }))} defaultValue="overig" required />
            <Field label="Bestand" name="file"><input id="file" name="file" type="file" accept=".pdf,.docx,.txt,.md" className="block w-full text-sm" required /></Field>
            <SubmitButton pendingText="Indexeren...">Uploaden</SubmitButton>
          </ActionForm>
        </Section>
      </div>
      <div className="mt-4">
        <Section title={`Bronnen (${docs.length})`} description={missing.length ? `${missing.length} standaardbronnen zijn nog niet geïmporteerd (pnpm knowledge:import).` : "Alle standaardbronnen zijn aanwezig."}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 pr-2">Titel</th><th className="py-2 pr-2">Type</th><th className="py-2 pr-2">Categorie</th><th className="py-2 pr-2">Versie</th><th className="py-2 pr-2 text-right">Fragmenten</th><th className="py-2 pr-2">Status</th><th className="py-2" /></tr></thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-b">
                    <td className="py-2 pr-2">{d.sourceUrl ? <a href={d.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">{d.title}</a> : d.title}<span className="block text-[11px] text-muted-foreground">{d.organizationId ? "eigen bron" : "gedeeld"} | {d.publisher}</span></td>
                    <td className="py-2 pr-2 text-xs">{d.sourceType}</td>
                    <td className="py-2 pr-2 text-xs">{d.category}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{d.versionLabel ?? "-"}<span className="block text-muted-foreground">{formatDateTime(d.fetchedAt)}</span></td>
                    <td className="py-2 pr-2 text-right font-mono text-xs">{d.chunkCount}</td>
                    <td className="py-2 pr-2"><span className="flex gap-1"><StatusBadge value={d.status === "actief" ? "geaccordeerd" : "afgewezen"} label={d.status} />{sourceIsStale(d.versionDate, d.fetchedAt) ? <StatusBadge value="ter_accordering" label="> 12 mnd" /> : null}</span>{d.error ? <span className="block text-[11px] text-velocity">{d.error}</span> : null}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <span className="inline-flex gap-1">
                        <ActionButton action={reindexSourceAction.bind(null, d.id)} variant="ghost" successMessage="Geherindexeerd">Herindexeren</ActionButton>
                        {d.organizationId || d.sourceType === "upload" ? <ActionButton action={deleteSourceAction.bind(null, d.id)} variant="ghost" confirm="Bron verwijderen?" successMessage="Verwijderd">Verwijderen</ActionButton> : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {missing.length ? <ul className="mt-3 text-xs text-muted-foreground">{missing.map((m) => <li key={m.key}>Niet geïmporteerd: {m.title}</li>)}</ul> : null}
        </Section>
      </div>
    </div>
  );
}
