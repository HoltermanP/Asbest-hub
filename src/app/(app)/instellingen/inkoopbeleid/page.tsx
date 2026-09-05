import { ActionForm } from "@/components/shared/action-form";
import { TextAreaField, TextField } from "@/components/shared/form-fields";
import { Section } from "@/components/shared/page-header";
import { SubmitButton } from "@/components/shared/submit-button";
import { updatePolicyAction } from "@/actions/settings";
import { requirePermission } from "@/lib/auth";
import { getOrganizationSettings } from "@/lib/organization";
import { can } from "@/lib/permissions";
import { EU_THRESHOLD_SERVICES_DECENTRAL, EU_THRESHOLD_WORKS } from "@/lib/thresholds";

export const dynamic = "force-dynamic";

export default async function PolicyPage() {
  const ctx = await requirePermission("settings:read");
  const s = await getOrganizationSettings(ctx.orgId);
  const p = s.procurementPolicy;
  return (
    <Section title="Inkoopbeleid en drempelwaarden" description={`Beleidsgrenzen voor de procedurekeuze (werken). Europese drempels 2024-2025: werken € ${EU_THRESHOLD_WORKS.toLocaleString("nl-NL")}, diensten/leveringen decentraal € ${EU_THRESHOLD_SERVICES_DECENTRAL.toLocaleString("nl-NL")}. Controleer altijd de actuele drempelwaarden.`}>
      <ActionForm action={updatePolicyAction} className="grid gap-4 md:grid-cols-2" successMessage="Inkoopbeleid opgeslagen">
        <TextField label="Enkelvoudig onderhands tot (EUR)" name="enkelvoudigTot" type="number" defaultValue={p.enkelvoudigTot} required />
        <TextField label="Meervoudig onderhands tot (EUR)" name="meervoudigTot" type="number" defaultValue={p.meervoudigTot} required />
        <TextField label="Europese drempel werken (EUR)" name="drempelWerken" type="number" defaultValue={p.drempelWerken} required hint="Daarboven Europees; daaronder nationaal openbaar" />
        <TextField label="Europese drempel diensten/leveringen (EUR)" name="drempelDiensten" type="number" defaultValue={p.drempelDiensten} required />
        <div className="md:col-span-2"><TextAreaField label="Toelichting (wordt aan de AI meegegeven)" name="toelichting" defaultValue={p.toelichting} rows={3} /></div>
        <div className="md:col-span-2">{can(ctx.role, "settings:write") ? <SubmitButton pendingText="Opslaan...">Opslaan</SubmitButton> : null}</div>
      </ActionForm>
    </Section>
  );
}
