"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SelectField, TextAreaField, TextField } from "@/components/shared/form-fields";
import { SubmitButton } from "@/components/shared/submit-button";
import { OBJECT_TYPE_LABELS, PROJECT_STATUS_LABELS, RISK_CLASS_LABELS } from "@/lib/labels";
import type { ActionResult } from "@/lib/action-result";
import type { ContactPerson, ProjectLocation } from "@/db/schema";

export interface ProjectFormValues {
  name: string;
  projectNumber: string;
  client: string;
  objectType: string;
  riskClass: string | null;
  status: string;
  constructionYear: number | null;
  budget: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  description: string | null;
  location: ProjectLocation;
  contacts: ContactPerson[];
}

export function ProjectForm({ action, initial, submitLabel, redirectOnCreate }: { action: (fd: FormData) => Promise<ActionResult<unknown>>; initial?: ProjectFormValues; submitLabel: string; redirectOnCreate?: boolean }) {
  const c = initial?.contacts[0];
  return (
    <ActionForm action={action} className="space-y-6" successMessage="Project opgeslagen" redirectTo={redirectOnCreate ? (d) => `/projecten/${(d as { id: string }).id}` : undefined}>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Projectnaam" name="name" defaultValue={initial?.name} required />
        <TextField label="Projectnummer" name="projectNumber" defaultValue={initial?.projectNumber} required />
        <TextField label="Opdrachtgever" name="client" defaultValue={initial?.client} required />
        <SelectField label="Objecttype" name="objectType" options={Object.entries(OBJECT_TYPE_LABELS).map(([value, label]) => ({ value, label }))} defaultValue={initial?.objectType ?? "woning"} required />
        <SelectField label="Risicoklasse (indicatief)" name="riskClass" options={Object.entries(RISK_CLASS_LABELS).map(([value, label]) => ({ value, label }))} defaultValue={initial?.riskClass ?? ""} />
        <SelectField label="Status" name="status" options={Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({ value, label }))} defaultValue={initial?.status ?? "initiatief"} required />
        <TextField label="Bouwjaar" name="constructionYear" type="number" defaultValue={initial?.constructionYear} min="1800" />
        <TextField label="Budget (EUR excl. btw)" name="budget" type="number" step="0.01" defaultValue={initial?.budget} />
        <TextField label="Geplande start uitvoering" name="plannedStart" type="date" defaultValue={initial?.plannedStart} hint="Bepaalt de uiterste indiendata van meldingen" />
        <TextField label="Geplande oplevering" name="plannedEnd" type="date" defaultValue={initial?.plannedEnd} />
      </div>
      <TextAreaField label="Omschrijving" name="description" defaultValue={initial?.description} rows={4} />
      <fieldset className="space-y-4 rounded-md border p-4">
        <legend className="px-1 text-sm font-medium">Locatie</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Adres" name="adres" defaultValue={initial?.location.adres} required />
          <TextField label="Postcode" name="postcode" defaultValue={initial?.location.postcode} />
          <TextField label="Plaats" name="plaats" defaultValue={initial?.location.plaats} required />
          <TextField label="Gemeente (bevoegd gezag)" name="gemeente" defaultValue={initial?.location.gemeente} required />
          <TextField label="Breedtegraad" name="lat" type="number" step="0.000001" defaultValue={initial?.location.lat} />
          <TextField label="Lengtegraad" name="lng" type="number" step="0.000001" defaultValue={initial?.location.lng} />
        </div>
      </fieldset>
      <fieldset className="space-y-4 rounded-md border p-4">
        <legend className="px-1 text-sm font-medium">Contactpersoon opdrachtgever</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Naam" name="contactNaam" defaultValue={c?.naam} />
          <TextField label="Functie" name="contactRol" defaultValue={c?.rol} />
          <TextField label="E-mail" name="contactEmail" type="email" defaultValue={c?.email} />
          <TextField label="Telefoon" name="contactTelefoon" defaultValue={c?.telefoon} />
        </div>
      </fieldset>
      <SubmitButton pendingText="Opslaan...">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
