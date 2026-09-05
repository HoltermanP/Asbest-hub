"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ActionForm } from "@/components/shared/action-form";
import { Field, TextAreaField, TextField } from "@/components/shared/form-fields";
import { SubmitButton } from "@/components/shared/submit-button";
import type { ActionResult } from "@/lib/action-result";

export function SessionDialog({ action, criteria, assessors }: { action: (fd: FormData) => Promise<ActionResult<unknown>>; criteria: Array<{ id: string; code: string; name: string; isPrice: boolean }>; assessors: Array<{ name: string; role: string }> }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Sessie aanmaken</Button>} />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Beoordelingssessie aanmaken</DialogTitle>
          <DialogDescription>Agenda: per criterium alle geldige inschrijvingen.</DialogDescription>
        </DialogHeader>
        <ActionForm action={action} className="space-y-3" successMessage="Sessie aangemaakt" onSuccess={() => setOpen(false)}>
          <TextField label="Titel" name="title" defaultValue="Consensussessie 1" required />
          <TextField label="Datum en tijd" name="scheduledAt" type="datetime-local" required />
          <TextAreaField label="Deelnemers (één per regel: naam | rol)" name="participants" defaultValue={assessors.map((a) => `${a.name} | ${a.role}`).join("\n")} rows={4} />
          <Field label="Criteria op de agenda" name="criterionIds">
            <div className="space-y-1">
              {criteria
                .filter((c) => !c.isPrice)
                .map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="criterionIds" value={c.id} defaultChecked /> {c.code} {c.name}
                  </label>
                ))}
            </div>
          </Field>
          <SubmitButton pendingText="Aanmaken...">Aanmaken</SubmitButton>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function SessionNotesForm({ action, initial }: { action: (fd: FormData) => Promise<ActionResult<unknown>>; initial: string }) {
  return (
    <ActionForm action={action} className="space-y-2" successMessage="Notulen opgeslagen">
      <TextAreaField label="Getypte notulen" name="notesText" defaultValue={initial} rows={12} placeholder="Per criterium en inschrijver: argumenten, afgesproken score, openstaande punten." />
      <SubmitButton size="sm" variant="outline" pendingText="Opslaan...">
        Notulen opslaan
      </SubmitButton>
    </ActionForm>
  );
}

export function SessionUploadForm({ action }: { action: (fd: FormData) => Promise<ActionResult<unknown>> }) {
  return (
    <ActionForm action={action} className="space-y-2" successMessage="Bestand verwerkt">
      <Field label="Transcript (txt/docx) of audio (mp3/m4a)" name="file" hint="Audio wordt getranscribeerd met OpenAI Whisper bij het verwerken van de sessie.">
        <input id="file" name="file" type="file" accept=".txt,.docx,.mp3,.m4a,.wav" className="block w-full text-sm" required />
      </Field>
      <SubmitButton size="sm" variant="outline" pendingText="Uploaden...">
        Uploaden
      </SubmitButton>
    </ActionForm>
  );
}
