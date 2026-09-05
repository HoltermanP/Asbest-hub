import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/shared/action-button";
import { Section } from "@/components/shared/page-header";
import { StakeholderDialog } from "@/components/projects/misc-forms";
import { deleteStakeholderAction, saveStakeholderAction } from "@/actions/projects";
import { requirePermission } from "@/lib/auth";
import { STAKEHOLDER_TYPE_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { loadProjectBundle } from "@/lib/project-data";

export const dynamic = "force-dynamic";

export default async function StakeholdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("project:read");
  const b = await loadProjectBundle(ctx.orgId, id);
  const writable = can(ctx.role, "project:write");
  return (
    <Section title="Betrokken partijen" description="Bevoegd gezag, inventarisatiebureau, saneerder, laboratorium, bewoners en nutsbedrijven." actions={writable ? <StakeholderDialog action={saveStakeholderAction.bind(null, id, null)} /> : null}>
      {b.stakeholders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nog geen betrokkenen.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2">Organisatie</th>
                <th className="py-2 pr-2">Contact</th>
                <th className="py-2 pr-2">Rol</th>
                <th className="py-2 pr-2">Notities</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {b.stakeholders.map((s) => (
                <tr key={s.id} className="border-b align-top">
                  <td className="py-2 pr-2 text-xs">{STAKEHOLDER_TYPE_LABELS[s.type]}</td>
                  <td className="py-2 pr-2 font-medium">{s.name}</td>
                  <td className="py-2 pr-2 text-xs">
                    {s.contactName ?? "-"}
                    {s.email ? <span className="block text-muted-foreground">{s.email}</span> : null}
                    {s.phone ? <span className="block text-muted-foreground">{s.phone}</span> : null}
                  </td>
                  <td className="py-2 pr-2 text-xs">{s.role ?? "-"}</td>
                  <td className="py-2 pr-2 text-xs text-muted-foreground">{s.notes ?? ""}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {writable ? (
                      <span className="inline-flex gap-1">
                        <StakeholderDialog action={saveStakeholderAction.bind(null, id, s.id)} initial={s} trigger={<Button size="sm" variant="ghost">Bewerken</Button>} />
                        <ActionButton action={deleteStakeholderAction.bind(null, s.id)} variant="ghost" confirm="Betrokkene verwijderen?" successMessage="Verwijderd">
                          Verwijderen
                        </ActionButton>
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
