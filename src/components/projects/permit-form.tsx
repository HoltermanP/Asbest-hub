"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ActionForm } from "@/components/shared/action-form";
import { SelectField, TextAreaField, TextField } from "@/components/shared/form-fields";
import { SubmitButton } from "@/components/shared/submit-button";
import { PERMIT_STATUS_LABELS, PERMIT_TYPE_LABELS } from "@/lib/labels";
import type { ActionResult } from "@/lib/action-result";

export interface PermitValues {
  id: string;
  type: string;
  authority: string;
  description: string | null;
  status: string;
  applicationDate: string | null;
  legalTermDays: number | null;
  legalTermWorkingDays: boolean;
  deadline: string | null;
  reference: string | null;
  draftText: string | null;
}

export function PermitDialog({ action, initial, trigger }: { action: (fd: FormData) => Promise<ActionResult<unknown>>; initial?: PermitValues; trigger?: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const isProposal = initial?.status === "voorgesteld";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button size="sm" variant="outline">Melding toevoegen</Button>} />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Melding bewerken" : "Melding of vergunning toevoegen"}</DialogTitle>
        </DialogHeader>
        {isProposal ? <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">Dit is een AI-voorstel. Accordeer het voorstel via Accorderingen voordat u de status wijzigt.</p> : null}
        <ActionForm action={action} className="grid gap-3 md:grid-cols-2" successMessage="Melding opgeslagen" onSuccess={() => setOpen(false)}>
          <SelectField label="Type" name="type" options={Object.entries(PERMIT_TYPE_LABELS).map(([value, label]) => ({ value, label }))} defaultValue={initial?.type ?? "sloopmelding"} required />
          <SelectField
            label="Status"
            name="status"
            options={Object.entries(PERMIT_STATUS_LABELS)
              .filter(([v]) => (isProposal ? v === "voorgesteld" : v !== "voorgesteld"))
              .map(([value, label]) => ({ value, label }))}
            defaultValue={initial?.status ?? "voorbereiden"}
            required
          />
          <TextField label="Bevoegd gezag" name="authority" defaultValue={initial?.authority} required />
          <TextField label="Kenmerk / zaaknummer" name="reference" defaultValue={initial?.reference} />
          <TextField label="Wettelijke termijn (dagen)" name="legalTermDays" type="number" defaultValue={initial?.legalTermDays} />
          <SelectField label="Termijn in" name="legalTermWorkingDays" options={[{ value: "0", label: "Kalenderdagen" }, { value: "1", label: "Werkdagen" }]} defaultValue={initial?.legalTermWorkingDays ? "1" : "0"} required />
          <TextField label="Uiterste indiendatum" name="deadline" type="date" defaultValue={initial?.deadline} hint="Leeg = berekend uit geplande start en termijn" />
          <TextField label="Datum ingediend" name="applicationDate" type="date" defaultValue={initial?.applicationDate} />
          <div className="md:col-span-2">
            <TextField label="Omschrijving" name="description" defaultValue={initial?.description} />
          </div>
          <div className="md:col-span-2">
            <TextAreaField label="Concept-meldingstekst" name="draftText" defaultValue={initial?.draftText} rows={6} hint="Kopieer deze tekst in het Omgevingsloket of LAVS. AsbestHub verstuurt zelf geen meldingen." />
          </div>
          <div className="md:col-span-2">
            <SubmitButton pendingText="Opslaan...">Opslaan</SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
