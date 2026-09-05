"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField, TextAreaField, TextField } from "@/components/shared/form-fields";
import { SubmitButton } from "@/components/shared/submit-button";
import { AWARD_METHOD_LABELS, CONTRACT_FORM_LABELS, TENDER_DOC_KIND_LABELS } from "@/lib/labels";
import { PROCEDURE_LABELS } from "@/lib/thresholds";
import type { ActionResult } from "@/lib/action-result";

export function TenderWizardForm({ action, projects, defaultProjectId }: { action: (fd: FormData) => Promise<ActionResult<unknown>>; projects: Array<{ id: string; name: string; projectNumber: string; budget: string | null; calculationTotal: number }>; defaultProjectId: string | null }) {
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? "");
  const selected = projects.find((p) => p.id === projectId);
  const suggested = selected ? (selected.calculationTotal > 0 ? selected.calculationTotal : selected.budget ? Number(selected.budget) : 0) : 0;
  return (
    <ActionForm action={action} className="space-y-6" successMessage="Aanbesteding aangemaakt" redirectTo={(d) => `/aanbestedingen/${(d as { id: string }).id}`}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <label htmlFor="projectId" className="text-sm font-medium">
            Project <span className="text-velocity">*</span>
          </label>
          <select id="projectId" name="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)} required className="border-input flex h-9 w-full rounded-md border bg-background px-3 text-sm">
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectNumber} - {p.name}
              </option>
            ))}
          </select>
        </div>
        <TextField label="Titel aanbesteding" name="title" defaultValue={selected ? `Asbestsanering ${selected.name}` : ""} required />
        <TextField label="Kenmerk" name="referenceNumber" placeholder="AANB-2026-002" required />
        <TextField key={projectId} label="Geraamde waarde (EUR excl. btw)" name="estimatedValue" type="number" step="0.01" defaultValue={suggested || ""} required hint={selected?.calculationTotal ? "Overgenomen uit de calculatie" : "Overgenomen uit het budget; pas aan indien nodig"} />
        <SelectField label="Gunningsmethode (voorlopig)" name="awardMethod" options={Object.entries(AWARD_METHOD_LABELS).map(([value, label]) => ({ value, label }))} defaultValue="bpkv_absolute_punten" required />
        <SelectField label="Contractvorm (voorlopig)" name="contractForm" options={Object.entries(CONTRACT_FORM_LABELS).map(([value, label]) => ({ value, label }))} defaultValue="uav" required />
        <SelectField label="Scoreschaal" name="scoreScale" options={[{ value: "10", label: "0-10" }, { value: "100", label: "0-100" }]} defaultValue="10" required />
      </div>
      <fieldset className="rounded-md border p-4">
        <legend className="px-1 text-sm font-medium">Planning (indicatief)</legend>
        <div className="grid gap-4 md:grid-cols-4">
          <TextField label="Publicatie" name="publicatie" type="date" />
          <TextField label="Nota van Inlichtingen" name="nvi" type="date" />
          <TextField label="Sluiting inschrijving" name="sluiting" type="date" />
          <TextField label="Gunning (voorlopig)" name="gunning" type="date" />
        </div>
      </fieldset>
      <label className="flex items-start gap-2 rounded-md border border-ai-blue/30 bg-accent p-3 text-sm">
        <input type="checkbox" name="aiDesign" value="1" defaultChecked className="mt-1" />
        <span>
          <strong>AI-voorstel voor procedure en gunningscriteria</strong>
          <span className="block text-xs text-muted-foreground">De AI toetst de raming aan de drempelwaarden en het inkoopbeleid en stelt criteria, wegingen en beoordelingsrichtlijnen voor. U kiest en accordeert.</span>
        </span>
      </label>
      <SubmitButton pendingText="Aanmaken...">Aanbesteding aanmaken</SubmitButton>
    </ActionForm>
  );
}

export interface TenderSetupValues {
  title: string;
  referenceNumber: string;
  estimatedValue: string;
  procedure: string;
  procedureRationale: string | null;
  awardMethod: string;
  contractForm: string;
  scoreScale: number;
  planning: { publicatie: string | null; nvi: string | null; sluiting: string | null; gunning: string | null };
  tenderNedReference: string | null;
  aiAdviceBefore: boolean;
}

export function TenderSetupForm({ action, initial }: { action: (fd: FormData) => Promise<ActionResult<unknown>>; initial: TenderSetupValues }) {
  return (
    <ActionForm action={action} className="space-y-6" successMessage="Opzet opgeslagen (opnieuw ter accordering)">
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Titel" name="title" defaultValue={initial.title} required />
        <TextField label="Kenmerk" name="referenceNumber" defaultValue={initial.referenceNumber} required />
        <TextField label="Geraamde waarde (EUR excl. btw)" name="estimatedValue" type="number" step="0.01" defaultValue={initial.estimatedValue} required />
        <SelectField label="Procedure" name="procedure" options={Object.entries(PROCEDURE_LABELS).map(([value, label]) => ({ value, label }))} defaultValue={initial.procedure} required />
        <div className="md:col-span-2">
          <TextAreaField label="Onderbouwing procedure" name="procedureRationale" defaultValue={initial.procedureRationale} rows={3} />
        </div>
        <SelectField label="Gunningsmethode" name="awardMethod" options={Object.entries(AWARD_METHOD_LABELS).map(([value, label]) => ({ value, label }))} defaultValue={initial.awardMethod} required />
        <SelectField label="Contractvorm" name="contractForm" options={Object.entries(CONTRACT_FORM_LABELS).map(([value, label]) => ({ value, label }))} defaultValue={initial.contractForm} required />
        <SelectField label="Scoreschaal" name="scoreScale" options={[{ value: "10", label: "0-10" }, { value: "100", label: "0-100" }]} defaultValue={String(initial.scoreScale)} required />
        <TextField label="TenderNed-kenmerk (na publicatie)" name="tenderNedReference" defaultValue={initial.tenderNedReference} />
        <SelectField label="AI-advies zichtbaar voor beoordelaars" name="aiAdviceBefore" options={[{ value: "0", label: "Na eigen score (standaard, beperkt beïnvloeding)" }, { value: "1", label: "Voor eigen score" }]} defaultValue={initial.aiAdviceBefore ? "1" : "0"} required />
      </div>
      <fieldset className="rounded-md border p-4">
        <legend className="px-1 text-sm font-medium">Planning</legend>
        <div className="grid gap-4 md:grid-cols-4">
          <TextField label="Publicatie" name="publicatie" type="date" defaultValue={initial.planning.publicatie} />
          <TextField label="Nota van Inlichtingen" name="nvi" type="date" defaultValue={initial.planning.nvi} />
          <TextField label="Sluiting" name="sluiting" type="date" defaultValue={initial.planning.sluiting} />
          <TextField label="Gunning" name="gunning" type="date" defaultValue={initial.planning.gunning} />
        </div>
      </fieldset>
      <SubmitButton pendingText="Opslaan...">Opslaan</SubmitButton>
    </ActionForm>
  );
}

export function CriterionDialog({ action, initial, trigger, scoreScale }: { action: (fd: FormData) => Promise<ActionResult<unknown>>; initial?: { code: string; name: string; description: string; weight: string; isPrice: boolean; maxDiscount: string | null; guideline: string; proportionalityNote: string | null }; trigger?: React.ReactElement; scoreScale: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button size="sm" variant="outline">Criterium toevoegen</Button>} />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Criterium bewerken" : "Criterium toevoegen"}</DialogTitle>
          <DialogDescription>Scoreschaal 0-{scoreScale}. Wegingen van alle criteria moeten samen 100 zijn.</DialogDescription>
        </DialogHeader>
        <ActionForm action={action} className="grid gap-3 md:grid-cols-2" successMessage="Criterium opgeslagen" onSuccess={() => setOpen(false)}>
          <TextField label="Code" name="code" defaultValue={initial?.code ?? ""} required />
          <TextField label="Naam" name="name" defaultValue={initial?.name} required />
          <TextField label="Weging (punten)" name="weight" type="number" step="0.01" defaultValue={initial?.weight} required />
          <SelectField label="Prijscriterium" name="isPrice" options={[{ value: "0", label: "Nee (kwaliteit)" }, { value: "1", label: "Ja (prijs)" }]} defaultValue={initial?.isPrice ? "1" : "0"} required />
          <TextField label="Max. fictieve korting (EUR, alleen bij gunnen op waarde)" name="maxDiscount" type="number" step="0.01" defaultValue={initial?.maxDiscount} />
          <div className="md:col-span-2">
            <TextAreaField label="Omschrijving (wat wordt beoordeeld)" name="description" defaultValue={initial?.description} rows={2} required />
          </div>
          <div className="md:col-span-2">
            <TextAreaField label="Beoordelingsrichtlijn (per scoreniveau)" name="guideline" defaultValue={initial?.guideline} rows={5} required />
          </div>
          <div className="md:col-span-2">
            <TextAreaField label="Proportionaliteit en objectiviteit" name="proportionalityNote" defaultValue={initial?.proportionalityNote} rows={2} />
          </div>
          <div className="md:col-span-2">
            <SubmitButton pendingText="Opslaan...">Opslaan</SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function QuestionDialog({ action }: { action: (fd: FormData) => Promise<ActionResult<unknown>> }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline">Vraag toevoegen</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vraag inschrijver toevoegen</DialogTitle>
        </DialogHeader>
        <ActionForm action={action} className="space-y-3" successMessage="Vraag toegevoegd" onSuccess={() => setOpen(false)}>
          <TextAreaField label="Vraag" name="question" rows={4} required />
          <TextField label="Vraagsteller (intern kenmerk, niet gepubliceerd)" name="askedBy" />
          <TextField label="Verwijzing naar stuk/paragraaf" name="documentReference" />
          <TextField label="Ronde" name="round" type="number" defaultValue={1} />
          <SubmitButton pendingText="Opslaan...">Toevoegen</SubmitButton>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function ImportQuestionsDialog({ action }: { action: (fd: FormData) => Promise<ActionResult<unknown>> }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline">Importeren (xlsx/csv)</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vragen importeren</DialogTitle>
          <DialogDescription>Kolommen: vraag | vraagsteller | documentverwijzing. Eerste rij is de koprij.</DialogDescription>
        </DialogHeader>
        <ActionForm action={action} className="space-y-3" successMessage="Vragen geïmporteerd" onSuccess={() => setOpen(false)}>
          <Field label="Bestand" name="file">
            <input id="file" name="file" type="file" accept=".xlsx,.csv" className="block w-full text-sm" required />
          </Field>
          <SubmitButton pendingText="Importeren...">Importeren</SubmitButton>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function FinalAnswerForm({ action, initial }: { action: (fd: FormData) => Promise<ActionResult<unknown>>; initial: string }) {
  return (
    <ActionForm action={action} className="space-y-2" successMessage="Antwoord opgeslagen">
      <TextAreaField label="Definitief antwoord (bewerk het AI-concept)" name="finalAnswer" defaultValue={initial} rows={6} required />
      <SubmitButton size="sm" variant="outline" pendingText="Opslaan...">
        Antwoord opslaan
      </SubmitButton>
    </ActionForm>
  );
}

export function AssessorDialog({ action }: { action: (fd: FormData) => Promise<ActionResult<unknown>> }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline">Beoordelaar uitnodigen</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Beoordelaar uitnodigen</DialogTitle>
          <DialogDescription>De beoordelaar ontvangt een e-mail. Externe beoordelaars zien alleen deze aanbesteding.</DialogDescription>
        </DialogHeader>
        <ActionForm action={action} className="space-y-3" successMessage="Uitnodiging verzonden" onSuccess={() => setOpen(false)}>
          <TextField label="Naam" name="name" required />
          <TextField label="E-mail" name="email" type="email" required />
          <SelectField label="Rol" name="role" options={[{ value: "beoordelaar", label: "Beoordelaar" }, { value: "voorzitter", label: "Voorzitter" }, { value: "extern", label: "Externe beoordelaar" }]} defaultValue="beoordelaar" required />
          <SubmitButton pendingText="Verzenden...">Uitnodigen</SubmitButton>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function UploadTenderDocumentDialog({ action, kinds }: { action: (fd: FormData) => Promise<ActionResult<unknown>>; kinds: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline">Bestand uploaden</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aanbestedingsstuk uploaden</DialogTitle>
        </DialogHeader>
        <ActionForm action={action} className="space-y-3" successMessage="Geüpload" onSuccess={() => setOpen(false)}>
          <SelectField label="Soort" name="kind" options={kinds.map((k) => ({ value: k, label: TENDER_DOC_KIND_LABELS[k] ?? k }))} defaultValue="overig" required />
          <TextField label="Titel" name="title" required />
          <Field label="Bestand (max 50 MB)" name="file">
            <input id="file" name="file" type="file" className="block w-full text-sm" required />
          </Field>
          <SubmitButton pendingText="Uploaden...">Uploaden</SubmitButton>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
