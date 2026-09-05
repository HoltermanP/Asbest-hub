"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";

export function ScoreForm({
  tenderId,
  bidId,
  criterionId,
  maxScore,
  initial,
  save,
}: {
  tenderId: string;
  bidId: string;
  criterionId: string;
  maxScore: number;
  initial: { score: number | null; motivation: string; status: "concept" | "ingediend" | null };
  save: (tenderId: string, bidId: string, criterionId: string, score: number, motivation: string, submit: boolean) => Promise<ActionResult<unknown>>;
}) {
  const [score, setScore] = useState(initial.score ?? "");
  const [motivation, setMotivation] = useState(initial.motivation);
  const [pending, start] = useTransition();
  const router = useRouter();
  const locked = initial.status === "ingediend";

  function run(submit: boolean) {
    const s = Number(score);
    if (!Number.isFinite(s)) {
      toast.error("Vul een score in");
      return;
    }
    if (submit && !window.confirm("Indienen vergrendelt deze score. Doorgaan?")) return;
    start(async () => {
      const res = await save(tenderId, bidId, criterionId, s, motivation, submit);
      if (res.ok) {
        toast.success(submit ? "Score ingediend en vergrendeld" : "Concept opgeslagen");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  if (locked) {
    return (
      <div className="rounded-md border bg-emerald-50/50 p-3 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <Lock className="size-4 text-emerald-700" /> Ingediend: <span className="font-mono">{initial.score}</span> / {maxScore}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{initial.motivation}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-end gap-3">
        <div className="w-28 space-y-1">
          <Label htmlFor={`score-${bidId}-${criterionId}`}>Score (0-{maxScore})</Label>
          <Input id={`score-${bidId}-${criterionId}`} type="number" min={0} max={maxScore} step={maxScore === 100 ? 1 : 0.5} value={score} onChange={(e) => setScore(e.target.value)} className="font-mono" />
        </div>
        <div className="flex-1 space-y-1">
          <Label htmlFor={`mot-${bidId}-${criterionId}`}>Motivatie (verplicht)</Label>
          <Textarea id={`mot-${bidId}-${criterionId}`} rows={3} value={motivation} onChange={(e) => setMotivation(e.target.value)} placeholder="Verwijs naar de richtlijn en concrete passages uit de inschrijving" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(false)}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null} Concept opslaan
        </Button>
        <Button size="sm" disabled={pending} onClick={() => run(true)}>
          Indienen (vergrendelen)
        </Button>
      </div>
    </div>
  );
}

export function ConsensusForm({
  tenderId,
  bidId,
  criterionId,
  maxScore,
  sessionId,
  initial,
  save,
}: {
  tenderId: string;
  bidId: string;
  criterionId: string;
  maxScore: number;
  sessionId: string | null;
  initial: { score: number | null; motivation: string; status: "concept" | "geaccordeerd" | null };
  save: (tenderId: string, bidId: string, criterionId: string, score: number, motivation: string, sessionId: string | null) => Promise<ActionResult<unknown>>;
}) {
  const [score, setScore] = useState(initial.score ?? "");
  const [motivation, setMotivation] = useState(initial.motivation);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (initial.status === "geaccordeerd") {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm">
        <p className="font-medium">
          Geaccordeerd: <span className="font-mono">{initial.score}</span> / {maxScore}
        </p>
        <p className="text-xs text-muted-foreground">{initial.motivation}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="flex items-end gap-2">
        <div className="w-24 space-y-1">
          <Label>Consensus</Label>
          <Input type="number" min={0} max={maxScore} step={0.5} value={score} onChange={(e) => setScore(e.target.value)} className="font-mono" />
        </div>
        <div className="flex-1 space-y-1">
          <Label>Motivatie</Label>
          <Textarea rows={2} value={motivation} onChange={(e) => setMotivation(e.target.value)} />
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await save(tenderId, bidId, criterionId, Number(score), motivation, sessionId);
            if (res.ok) {
              toast.success("Consensusscore opgeslagen (concept)");
              router.refresh();
            } else toast.error(res.error);
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null} Opslaan als concept
      </Button>
    </div>
  );
}
