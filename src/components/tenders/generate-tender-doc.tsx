"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TENDER_DOC_KIND_LABELS } from "@/lib/labels";
import type { ActionResult } from "@/lib/action-result";

export function GenerateTenderDocDialog({ kinds, generate, existingDocumentId, fixedKind, triggerLabel = "Genereer stuk (AI)" }: { kinds: string[]; generate: (kind: string, existingDocumentId: string | null, instructions: string | null) => Promise<ActionResult<unknown>>; existingDocumentId?: string | null; fixedKind?: string; triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(fixedKind ?? kinds[0] ?? "aanbestedingsleidraad");
  const [instructions, setInstructions] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><Sparkles className="size-4" /> {triggerLabel}</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existingDocumentId ? "Nieuwe versie genereren" : "Aanbestedingsstuk genereren"}</DialogTitle>
          <DialogDescription>De AI schrijft een concept op basis van de opzet, criteria, projectdata en kennisbank. Het stuk wordt pas definitief na uw accordering.</DialogDescription>
        </DialogHeader>
        {!fixedKind ? (
          <div className="space-y-1.5">
            <Label htmlFor="tdoc-kind">Soort stuk</Label>
            <select id="tdoc-kind" value={kind} onChange={(e) => setKind(e.target.value)} className="border-input flex h-9 w-full rounded-md border bg-background px-3 text-sm">
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {TENDER_DOC_KIND_LABELS[k] ?? k}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="tdoc-instr">Aanvullende instructies (optioneel)</Label>
          <Textarea id="tdoc-instr" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </div>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await generate(kind, existingDocumentId ?? null, instructions || null);
              if (res.ok) {
                toast.success("AI-taak gestart.");
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
