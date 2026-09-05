"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm } from "@/components/shared/action-form";
import { Field, TextField } from "@/components/shared/form-fields";
import { SubmitButton } from "@/components/shared/submit-button";
import type { ActionResult } from "@/lib/action-result";

export function BidUploadDialog({ action }: { action: (fd: FormData) => Promise<ActionResult<unknown>> }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Inschrijving uploaden</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inschrijving registreren</DialogTitle>
          <DialogDescription>Upload alle stukken van één inschrijver (pdf, docx, xlsx; max 50 MB per bestand). Tekst wordt geëxtraheerd, gechunkt en geëmbed voor de beoordeling.</DialogDescription>
        </DialogHeader>
        <ActionForm action={action} className="space-y-3" successMessage="Inschrijving geregistreerd; tekstextractie loopt" onSuccess={() => setOpen(false)}>
          <TextField label="Naam inschrijver" name="bidderName" required />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="KVK-nummer" name="bidderKvk" />
            <TextField label="Ontvangen op" name="receivedAt" type="datetime-local" />
          </div>
          <TextField label="Inschrijfsom (EUR excl. btw)" name="price" type="number" step="0.01" hint="Leeg = uit prijsblad (xlsx) afgeleid" />
          <Field label="Bestanden" name="files">
            <input id="files" name="files" type="file" multiple accept=".pdf,.docx,.xlsx" className="block w-full text-sm" required />
          </Field>
          <SubmitButton pendingText="Uploaden...">Registreren</SubmitButton>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function ExclusionDialog({ propose, bidderName }: { propose: (reason: string) => Promise<ActionResult<unknown>>; bidderName: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="destructive">Uitsluiting voorstellen</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Uitsluiting voorstellen: {bidderName}</DialogTitle>
          <DialogDescription>Uitsluiting wordt pas van kracht na accordering door een projectleider of beheerder. De AI kan nooit uitsluiten.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="excl-reason">Onderbouwing (verplicht)</Label>
          <Textarea id="excl-reason" rows={5} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <Button
          className="btn-approve"
          disabled={pending || reason.trim().length < 10}
          onClick={() =>
            start(async () => {
              const res = await propose(reason);
              if (res.ok) {
                toast.success("Uitsluitingsvoorstel ter accordering aangeboden");
                setOpen(false);
                router.refresh();
              } else toast.error(res.error);
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null} Ter accordering aanbieden
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function BidPriceDialog({ action, initial }: { action: (fd: FormData) => Promise<ActionResult<unknown>>; initial: { price: string | null; bidderKvk: string | null } }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="ghost">Prijs/KVK bewerken</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inschrijfsom en KVK</DialogTitle>
        </DialogHeader>
        <ActionForm action={action} className="space-y-3" successMessage="Opgeslagen" onSuccess={() => setOpen(false)}>
          <TextField label="Inschrijfsom (EUR excl. btw)" name="price" type="number" step="0.01" defaultValue={initial.price} required />
          <TextField label="KVK-nummer" name="bidderKvk" defaultValue={initial.bidderKvk} />
          <SubmitButton pendingText="Opslaan...">Opslaan</SubmitButton>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
