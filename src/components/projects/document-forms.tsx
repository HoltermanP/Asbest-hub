"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField, TextField } from "@/components/shared/form-fields";
import { SubmitButton } from "@/components/shared/submit-button";
import { DOCUMENT_TYPE_LABELS } from "@/lib/labels";
import type { ActionResult } from "@/lib/action-result";

export function GenerateDocumentDialog({
  documentTypes,
  generate,
  existingDocumentId,
  fixedType,
  triggerLabel = "Genereer met AI",
}: {
  documentTypes: string[];
  generate: (documentType: string, existingDocumentId: string | null, instructions: string | null) => Promise<ActionResult<unknown>>;
  existingDocumentId?: string | null;
  fixedType?: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(fixedType ?? documentTypes[0] ?? "projectplan");
  const [instructions, setInstructions] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Sparkles className="size-4" /> {triggerLabel}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existingDocumentId ? "Nieuwe versie genereren" : "Document genereren"}</DialogTitle>
          <DialogDescription>
            De AI schrijft een concept op basis van de projectdata en de kennisbank. Het concept wordt pas definitief na uw accordering.
          </DialogDescription>
        </DialogHeader>
        {!fixedType ? (
          <div className="space-y-1.5">
            <Label htmlFor="gen-type">Documenttype</Label>
            <select id="gen-type" value={type} onChange={(e) => setType(e.target.value)} className="border-input flex h-9 w-full rounded-md border bg-background px-3 text-sm">
              {documentTypes.map((t) => (
                <option key={t} value={t}>
                  {DOCUMENT_TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="gen-instr">Aanvullende instructies (optioneel)</Label>
          <Textarea id="gen-instr" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Bijv. leg extra nadruk op bewonerscommunicatie" />
        </div>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await generate(type, existingDocumentId ?? null, instructions || null);
              if (res.ok) {
                toast.success("AI-taak gestart. De voortgang verschijnt op de pagina.");
                setOpen(false);
                router.refresh();
              } else toast.error(res.error);
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Start generatie
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function UploadDocumentDialog({ action, types }: { action: (fd: FormData) => Promise<ActionResult<unknown>>; types: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline">Bestand uploaden</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Document uploaden</DialogTitle>
        </DialogHeader>
        <ActionForm action={action} className="space-y-4" successMessage="Document geüpload" onSuccess={() => setOpen(false)}>
          <SelectField label="Type" name="type" options={types.map((t) => ({ value: t, label: DOCUMENT_TYPE_LABELS[t] ?? t }))} defaultValue="overig" required />
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
