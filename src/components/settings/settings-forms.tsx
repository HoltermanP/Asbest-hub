"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField, TextAreaField, TextField } from "@/components/shared/form-fields";
import { SubmitButton } from "@/components/shared/submit-button";
import { COST_TYPE_LABELS, DOCUMENT_TYPE_LABELS, RISK_CLASS_LABELS, TENDER_DOC_KIND_LABELS } from "@/lib/labels";
import type { ActionResult } from "@/lib/action-result";

export function PriceBookItemDialog({ action, initial, trigger }: { action: (fd: FormData) => Promise<ActionResult<unknown>>; initial?: { code: string; activity: string; unit: string; unitPrice: string; costType: string; riskClass: string | null; notes: string | null }; trigger?: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button size="sm">Regel toevoegen</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Prijzenboekregel bewerken" : "Prijzenboekregel toevoegen"}</DialogTitle></DialogHeader>
        <ActionForm action={action} className="grid gap-3 md:grid-cols-2" successMessage="Opgeslagen" onSuccess={() => setOpen(false)}>
          <TextField label="Code" name="code" defaultValue={initial?.code} required />
          <SelectField label="Kostensoort" name="costType" options={Object.entries(COST_TYPE_LABELS).map(([value, label]) => ({ value, label }))} defaultValue={initial?.costType ?? "sanering"} required />
          <div className="md:col-span-2"><TextField label="Activiteit" name="activity" defaultValue={initial?.activity} required /></div>
          <TextField label="Eenheid" name="unit" defaultValue={initial?.unit ?? "m2"} required />
          <TextField label="Eenheidsprijs (EUR excl. btw)" name="unitPrice" type="number" step="0.01" defaultValue={initial?.unitPrice} required />
          <SelectField label="Risicoklasse" name="riskClass" options={Object.entries(RISK_CLASS_LABELS).map(([value, label]) => ({ value, label }))} defaultValue={initial?.riskClass ?? ""} />
          <TextField label="Notities" name="notes" defaultValue={initial?.notes} />
          <div className="md:col-span-2"><SubmitButton pendingText="Opslaan...">Opslaan</SubmitButton></div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

const TEMPLATE_KEYS = [...Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({ value, label: `Project: ${label}` })), ...Object.entries(TENDER_DOC_KIND_LABELS).map(([value, label]) => ({ value, label: `Aanbesteding: ${label}` }))];

export function TemplateDialog({ action, initial, trigger }: { action: (fd: FormData) => Promise<ActionResult<unknown>>; initial?: { kind: string; key: string; name: string; description: string | null; promptAddition: string | null; active: boolean }; trigger?: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(initial?.kind ?? "prompt");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button size="sm">Sjabloon toevoegen</Button>} />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Sjabloon bewerken" : "Sjabloon toevoegen"}</DialogTitle>
          <DialogDescription>Promptaanpassingen sturen de AI per documenttype (huisstijl, verplichte paragrafen, terminologie). DOCX-sjablonen met merge-velden {"{{veld}}"} worden geregistreerd als huisstijlreferentie.</DialogDescription>
        </DialogHeader>
        <ActionForm action={action} className="space-y-3" successMessage="Sjabloon opgeslagen" onSuccess={() => setOpen(false)}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="kind" className="text-sm font-medium">Soort</label>
              <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="border-input flex h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value="prompt">Promptaanpassing</option>
                <option value="docx">DOCX-sjabloon</option>
              </select>
            </div>
            <SelectField label="Documenttype (sleutel)" name="key" options={TEMPLATE_KEYS} defaultValue={initial?.key ?? "projectplan"} required />
          </div>
          <TextField label="Naam" name="name" defaultValue={initial?.name} required />
          <TextField label="Omschrijving" name="description" defaultValue={initial?.description} />
          {kind === "prompt" ? <TextAreaField label="Instructies voor de AI" name="promptAddition" defaultValue={initial?.promptAddition} rows={6} placeholder="Bijv. Gebruik altijd de paragraafindeling van ons handboek; noem de projectleider 'directievoerder'." /> : (
            <Field label="DOCX-bestand" name="file" hint="Merge-velden in de vorm {{projectnaam}} worden automatisch herkend."><input id="file" name="file" type="file" accept=".docx" className="block w-full text-sm" /></Field>
          )}
          <SelectField label="Actief" name="active" options={[{ value: "1", label: "Ja" }, { value: "0", label: "Nee" }]} defaultValue={initial?.active === false ? "0" : "1"} required />
          <SubmitButton pendingText="Opslaan...">Opslaan</SubmitButton>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteOrganizationData({ action }: { action: (confirmation: string) => Promise<ActionResult<unknown>> }) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-2 rounded-md border border-velocity/50 bg-red-50/40 p-4">
      <p className="text-sm font-medium">Alle organisatiegegevens verwijderen (AVG)</p>
      <p className="text-xs text-muted-foreground">Verwijdert projecten, aanbestedingen, inschrijvingen, documenten, kennisbronnen, taken en logs van deze organisatie in AsbestHub. Gebruikersaccounts in Clerk blijven bestaan. Dit kan niet ongedaan worden gemaakt.</p>
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Typ VERWIJDER ALLES" className="max-w-xs font-mono" />
        <Button variant="destructive" disabled={pending || value !== "VERWIJDER ALLES"} onClick={() => start(async () => { const res = await action(value); if (res.ok) { toast.success("Gegevens verwijderd"); router.push("/projecten"); router.refresh(); } else toast.error(res.error); })}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null} Definitief verwijderen
        </Button>
      </div>
    </div>
  );
}
