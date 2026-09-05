"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ActionForm } from "@/components/shared/action-form";
import { SelectField, TextAreaField, TextField } from "@/components/shared/form-fields";
import { SubmitButton } from "@/components/shared/submit-button";
import { COST_TYPE_LABELS, PHASE_STATUS_LABELS, STAKEHOLDER_TYPE_LABELS } from "@/lib/labels";
import type { ActionResult } from "@/lib/action-result";

export function StakeholderDialog({ action, initial, trigger }: { action: (fd: FormData) => Promise<ActionResult<unknown>>; initial?: { type: string; name: string; contactName: string | null; email: string | null; phone: string | null; role: string | null; notes: string | null }; trigger?: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button size="sm">Betrokkene toevoegen</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Betrokkene bewerken" : "Betrokkene toevoegen"}</DialogTitle>
        </DialogHeader>
        <ActionForm action={action} className="grid gap-3 md:grid-cols-2" successMessage="Opgeslagen" onSuccess={() => setOpen(false)}>
          <SelectField label="Type" name="type" options={Object.entries(STAKEHOLDER_TYPE_LABELS).map(([value, label]) => ({ value, label }))} defaultValue={initial?.type ?? "saneerder"} required />
          <TextField label="Organisatie" name="name" defaultValue={initial?.name} required />
          <TextField label="Contactpersoon" name="contactName" defaultValue={initial?.contactName} />
          <TextField label="Rol in project" name="role" defaultValue={initial?.role} />
          <TextField label="E-mail" name="email" type="email" defaultValue={initial?.email} />
          <TextField label="Telefoon" name="phone" defaultValue={initial?.phone} />
          <div className="md:col-span-2">
            <TextAreaField label="Notities" name="notes" defaultValue={initial?.notes} rows={2} />
          </div>
          <div className="md:col-span-2">
            <SubmitButton pendingText="Opslaan...">Opslaan</SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function CalculationLineDialog({
  action,
  priceBook,
  sources,
  initial,
  trigger,
}: {
  action: (fd: FormData) => Promise<ActionResult<unknown>>;
  priceBook: Array<{ id: string; code: string; activity: string; unit: string; unitPrice: string; costType: string }>;
  sources: Array<{ id: string; code: string; material: string }>;
  initial?: { activity: string; quantity: string; unit: string; unitPrice: string; costType: string; rationale: string | null; priceBookItemId: string | null; sourceId: string | null };
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button size="sm" variant="outline">Regel toevoegen</Button>} />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Calculatieregel bewerken" : "Calculatieregel toevoegen"}</DialogTitle>
        </DialogHeader>
        <ActionForm action={action} className="grid gap-3 md:grid-cols-2" successMessage="Regel opgeslagen" onSuccess={() => setOpen(false)}>
          <div className="md:col-span-2">
            <SelectField label="Prijzenboekregel" name="priceBookItemId" options={priceBook.map((p) => ({ value: p.id, label: `${p.code} - ${p.activity} (${p.unit}, € ${p.unitPrice})` }))} defaultValue={initial?.priceBookItemId ?? ""} hint="Vult activiteit, eenheid en prijs in als die leeg zijn" />
          </div>
          <SelectField label="Bron" name="sourceId" options={sources.map((s) => ({ value: s.id, label: `${s.code} - ${s.material}` }))} defaultValue={initial?.sourceId ?? ""} />
          <SelectField label="Kostensoort" name="costType" options={Object.entries(COST_TYPE_LABELS).map(([value, label]) => ({ value, label }))} defaultValue={initial?.costType ?? "sanering"} required />
          <div className="md:col-span-2">
            <TextField label="Activiteit" name="activity" defaultValue={initial?.activity} />
          </div>
          <TextField label="Hoeveelheid" name="quantity" type="number" step="0.01" defaultValue={initial?.quantity} required />
          <TextField label="Eenheid" name="unit" defaultValue={initial?.unit} />
          <TextField label="Eenheidsprijs (EUR)" name="unitPrice" type="number" step="0.01" defaultValue={initial?.unitPrice} />
          <div className="md:col-span-2">
            <TextField label="Onderbouwing" name="rationale" defaultValue={initial?.rationale} />
          </div>
          <div className="md:col-span-2">
            <SubmitButton pendingText="Opslaan...">Opslaan</SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function ScheduleItemDialog({ action, initial, keys, trigger }: { action: (fd: FormData) => Promise<ActionResult<unknown>>; initial?: { key: string; name: string; startDate: string; endDate: string; dependsOn: string[]; responsible: string | null; isCritical: boolean }; keys: string[]; trigger?: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button size="sm" variant="outline">Activiteit toevoegen</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Activiteit bewerken" : "Activiteit toevoegen"}</DialogTitle>
        </DialogHeader>
        <ActionForm action={action} className="grid gap-3 md:grid-cols-2" successMessage="Activiteit opgeslagen" onSuccess={() => setOpen(false)}>
          <div className="md:col-span-2">
            <TextField label="Naam" name="name" defaultValue={initial?.name} required />
          </div>
          {!initial ? <TextField label="Sleutel (uniek, a-z0-9_)" name="key" hint="Leeg = afgeleid van naam" /> : null}
          <TextField label="Verantwoordelijke" name="responsible" defaultValue={initial?.responsible} />
          <TextField label="Startdatum" name="startDate" type="date" defaultValue={initial?.startDate} required />
          <TextField label="Einddatum" name="endDate" type="date" defaultValue={initial?.endDate} required />
          <div className="md:col-span-2">
            <TextField label="Afhankelijk van (sleutels, komma-gescheiden)" name="dependsOn" defaultValue={initial?.dependsOn.join(", ")} hint={keys.length ? `Beschikbaar: ${keys.join(", ")}` : undefined} />
          </div>
          <SelectField label="Kritiek pad" name="isCritical" options={[{ value: "0", label: "Nee" }, { value: "1", label: "Ja" }]} defaultValue={initial?.isCritical ? "1" : "0"} required />
          <div className="md:col-span-2">
            <SubmitButton pendingText="Opslaan...">Opslaan</SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function PhaseEditDialog({ action, initial }: { action: (fd: FormData) => Promise<ActionResult<unknown>>; initial: { status: string; responsible: string | null; deadline: string | null } }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="ghost">Bewerken</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fase bewerken</DialogTitle>
        </DialogHeader>
        <ActionForm action={action} className="space-y-3" successMessage="Fase bijgewerkt" onSuccess={() => setOpen(false)}>
          <SelectField label="Status" name="status" options={Object.entries(PHASE_STATUS_LABELS).map(([value, label]) => ({ value, label }))} defaultValue={initial.status} required />
          <TextField label="Verantwoordelijke" name="responsible" defaultValue={initial.responsible} />
          <TextField label="Deadline" name="deadline" type="date" defaultValue={initial.deadline} />
          <SubmitButton pendingText="Opslaan...">Opslaan</SubmitButton>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function AddChecklistItemForm({ action }: { action: (fd: FormData) => Promise<ActionResult<unknown>> }) {
  return (
    <ActionForm action={action} className="flex items-end gap-2" successMessage="Checklistpunt toegevoegd">
      <div className="flex-1">
        <TextField label="Nieuw checklistpunt" name="label" placeholder="Omschrijving" />
      </div>
      <SubmitButton size="sm" variant="outline">
        Toevoegen
      </SubmitButton>
    </ActionForm>
  );
}
