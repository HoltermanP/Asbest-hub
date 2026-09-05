import { ActionForm } from "@/components/shared/action-form";
import { SelectField, TextField } from "@/components/shared/form-fields";
import { Section } from "@/components/shared/page-header";
import { SubmitButton } from "@/components/shared/submit-button";
import { DeleteOrganizationData } from "@/components/settings/settings-forms";
import { deleteOrganizationDataAction, updateOrganizationAction } from "@/actions/settings";
import { requirePermission } from "@/lib/auth";
import { getOrganizationSettings } from "@/lib/organization";
import { can, ROLE_LABELS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function OrganizationSettingsPage() {
  const ctx = await requirePermission("settings:read");
  const s = await getOrganizationSettings(ctx.orgId);
  const writable = can(ctx.role, "settings:write");
  return (
    <div className="space-y-4">
      <Section title="Organisatie" description={`Uw rol: ${ROLE_LABELS[ctx.role]}. Organisatie-id: ${ctx.orgId}`}>
        <ActionForm action={updateOrganizationAction} className="grid gap-4 md:grid-cols-2" successMessage="Organisatie opgeslagen">
          <TextField label="Naam (op documenten)" name="name" defaultValue={s.name} required />
          <SelectField label="Type organisatie" name="orgType" options={[{ value: "gemeente", label: "Gemeente" }, { value: "woningcorporatie", label: "Woningcorporatie" }, { value: "netbeheerder", label: "Netbeheerder" }, { value: "aannemer", label: "Aannemer" }, { value: "overig", label: "Overig" }]} defaultValue={s.orgType} required />
          <TextField label="Adres" name="address" defaultValue={s.address} />
          <TextField label="KVK-nummer" name="kvk" defaultValue={s.kvk} />
          <TextField label="Notificatie-e-mail (fallback voor herinneringen)" name="notificationEmail" type="email" defaultValue={s.notificationEmail} />
          <div className="md:col-span-2">{writable ? <SubmitButton pendingText="Opslaan...">Opslaan</SubmitButton> : null}</div>
        </ActionForm>
      </Section>
      {can(ctx.role, "org:delete") ? <DeleteOrganizationData action={deleteOrganizationDataAction} /> : null}
    </div>
  );
}
