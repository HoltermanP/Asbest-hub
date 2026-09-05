import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/shared/action-button";
import { Section } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { TemplateDialog } from "@/components/settings/settings-forms";
import { deleteTemplateAction, saveTemplateAction } from "@/actions/settings";
import { requirePermission } from "@/lib/auth";
import { DOCUMENT_TYPE_LABELS, TENDER_DOC_KIND_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { fileDownloadPath } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const ctx = await requirePermission("settings:read");
  const rows = await db.query.templates.findMany({ where: eq(templates.organizationId, ctx.orgId), orderBy: asc(templates.key) });
  const writable = can(ctx.role, "settings:write");
  return (
    <Section title="Documentsjablonen en promptaanpassingen" description="Per documenttype kunt u de AI organisatiespecifieke instructies geven en een DOCX-huisstijlsjabloon registreren." actions={writable ? <TemplateDialog action={saveTemplateAction.bind(null, null)} /> : null}>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nog geen sjablonen. De standaard huisstijl van AsbestHub wordt gebruikt.</p> : (
        <ul className="divide-y">
          {rows.map((t) => (
            <li key={t.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
              <div>
                <p className="font-medium">{t.name} <span className="font-mono text-xs text-muted-foreground">{t.kind} | {DOCUMENT_TYPE_LABELS[t.key] ?? TENDER_DOC_KIND_LABELS[t.key] ?? t.key}</span></p>
                {t.description ? <p className="text-xs text-muted-foreground">{t.description}</p> : null}
                {t.promptAddition ? <pre className="mt-1 max-w-2xl whitespace-pre-wrap rounded bg-muted p-2 font-sans text-xs">{t.promptAddition}</pre> : null}
                {t.mergeFields.length ? <p className="mt-1 font-mono text-xs text-muted-foreground">Merge-velden: {t.mergeFields.join(", ")}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge value={t.active ? "geaccordeerd" : "verouderd"} label={t.active ? "actief" : "inactief"} />
                {t.fileUrl ? <Button size="sm" variant="outline" render={<a href={fileDownloadPath(t.fileUrl, `${t.name}.docx`)}>docx</a>} /> : null}
                {writable ? (<><TemplateDialog action={saveTemplateAction.bind(null, t.id)} initial={t} trigger={<Button size="sm" variant="ghost">Bewerken</Button>} /><ActionButton action={deleteTemplateAction.bind(null, t.id)} variant="ghost" confirm="Sjabloon verwijderen?" successMessage="Verwijderd">Verwijderen</ActionButton></>) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
