"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";

/**
 * The one approval component. Always Velocity Red, always with a confirmation
 * dialog that shows what will be recorded. Rejection requires a reason.
 */
export function ApproveButton({
  approvalId,
  label,
  summary,
  decide,
  size = "sm",
}: {
  approvalId: string;
  label: string;
  summary: Array<{ label: string; value: string }>;
  decide: (input: { approvalId: string; decision: "goedgekeurd" | "afgewezen"; comment: string }) => Promise<ActionResult<unknown>>;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"goedgekeurd" | "afgewezen">("goedgekeurd");
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    if (mode === "afgewezen" && comment.trim().length < 5) {
      toast.error("Geef een reden van minimaal 5 tekens voor afwijzing.");
      return;
    }
    start(async () => {
      const res = await decide({ approvalId, decision: mode, comment });
      if (res.ok) {
        toast.success(mode === "goedgekeurd" ? "Geaccordeerd en vastgelegd." : "Afgewezen; de reden gaat mee naar de volgende iteratie.");
        setOpen(false);
        setComment("");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          size={size}
          className="btn-approve"
          onClick={() => {
            setMode("goedgekeurd");
            setOpen(true);
          }}
        >
          Accorderen
        </Button>
        <Button
          size={size}
          variant="outline"
          onClick={() => {
            setMode("afgewezen");
            setOpen(true);
          }}
        >
          Afwijzen
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "goedgekeurd" ? "Accordering bevestigen" : "Afwijzen met reden"}</DialogTitle>
            <DialogDescription>
              {mode === "goedgekeurd"
                ? "Met uw accordering wordt het onderstaande definitief vastgelegd, met uw naam en tijdstip in de audittrail."
                : "Uw reden wordt vastgelegd en meegegeven aan een nieuwe AI-iteratie."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{label}</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {summary.map((s) => (
                <div key={s.label} className="contents">
                  <dt className="text-muted-foreground">{s.label}</dt>
                  <dd className="font-mono text-xs">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="approval-comment">{mode === "goedgekeurd" ? "Opmerking (optioneel)" : "Reden van afwijzing (verplicht)"}</Label>
            <Textarea id="approval-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Annuleren
            </Button>
            <Button className={mode === "goedgekeurd" ? "btn-approve" : ""} variant={mode === "goedgekeurd" ? "default" : "destructive"} onClick={submit} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === "goedgekeurd" ? "Definitief accorderen" : "Afwijzen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Button that opens an approval request (moves an entity to "ter accordering"). */
export function RequestApprovalButton({
  request,
  label = "Ter accordering aanbieden",
  size = "sm",
}: {
  request: () => Promise<ActionResult<unknown>>;
  label?: string;
  size?: "sm" | "default";
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      size={size}
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await request();
          if (res.ok) {
            toast.success("Accorderingsverzoek aangemaakt.");
            router.refresh();
          } else toast.error(res.error);
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {label}
    </Button>
  );
}
