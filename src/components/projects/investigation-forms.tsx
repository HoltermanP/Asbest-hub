"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField, TextField } from "@/components/shared/form-fields";
import { SubmitButton } from "@/components/shared/submit-button";
import { BONDING_LABELS, INVESTIGATION_TYPE_LABELS, RISK_CLASS_LABELS } from "@/lib/labels";
import type { ActionResult } from "@/lib/action-result";

export function InvestigationDialog({ action }: { action: (fd: FormData) => Promise<ActionResult<unknown>> }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Onderzoek toevoegen</Button>} />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Onderzoek toevoegen</DialogTitle>
        </DialogHeader>
        <ActionForm action={action} className="space-y-4" successMessage="Onderzoek toegevoegd" onSuccess={() => setOpen(false)}>
          <SelectField label="Type onderzoek" name="type" options={Object.entries(INVESTIGATION_TYPE_LABELS).map(([value, label]) => ({ value, label }))} defaultValue="inventarisatie_a" required />
          <TextField label="Uitvoerend bureau" name="agency" required />
          <TextField label="Certificaatnummer (Ascert)" name="certificateNumber" />
          <TextField label="Rapportdatum" name="reportDate" type="date" required hint="Inventarisatierapporten zijn 3 jaar geldig" />
          <Field label="Rapport (pdf, max 50 MB)" name="file">
            <input id="file" name="file" type="file" accept="application/pdf,.pdf" className="block w-full text-sm" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="extract" value="1" defaultChecked /> Direct bronnenlijst laten extraheren door AI (u accordeert het resultaat)
          </label>
          <SubmitButton pendingText="Uploaden...">Opslaan</SubmitButton>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export interface SourceValues {
  id: string;
  code: string;
  locationInObject: string;
  material: string;
  bonding: string;
  quantity: string;
  unit: string;
  riskClass: string;
  removalMethod: string;
}

export function SourceDialog({ action, initial, trigger }: { action: (fd: FormData) => Promise<ActionResult<unknown>>; initial?: SourceValues; trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Bron bewerken" : "Bron toevoegen"}</DialogTitle>
        </DialogHeader>
        <ActionForm action={action} className="grid gap-3 md:grid-cols-2" successMessage="Bron opgeslagen" onSuccess={() => setOpen(false)}>
          <TextField label="Code" name="code" defaultValue={initial?.code ?? ""} required />
          <SelectField label="Risicoklasse" name="riskClass" options={Object.entries(RISK_CLASS_LABELS).map(([value, label]) => ({ value, label }))} defaultValue={initial?.riskClass ?? "2"} required />
          <div className="md:col-span-2">
            <TextField label="Locatie in object" name="locationInObject" defaultValue={initial?.locationInObject} required />
          </div>
          <div className="md:col-span-2">
            <TextField label="Materiaal / toepassing" name="material" defaultValue={initial?.material} required />
          </div>
          <SelectField label="Hechtgebondenheid" name="bonding" options={Object.entries(BONDING_LABELS).map(([value, label]) => ({ value, label }))} defaultValue={initial?.bonding ?? "onbekend"} required />
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Hoeveelheid" name="quantity" type="number" step="0.01" defaultValue={initial?.quantity} required />
            <TextField label="Eenheid" name="unit" defaultValue={initial?.unit ?? "m2"} required />
          </div>
          <div className="md:col-span-2">
            <TextField label="Saneringsmethode" name="removalMethod" defaultValue={initial?.removalMethod} required />
          </div>
          <div className="md:col-span-2">
            <SubmitButton pendingText="Opslaan...">Opslaan</SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
