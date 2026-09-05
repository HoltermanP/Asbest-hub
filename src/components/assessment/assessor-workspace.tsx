"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiAdvicePanel, type AiAdviceData } from "./ai-advice";
import { ScoreForm } from "./score-form";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

export interface WorkspaceCriterion {
  id: string;
  code: string;
  name: string;
  description: string;
  guideline: string;
  weight: number;
  maxScore: number;
}
export interface WorkspaceBid {
  id: string;
  bidderName: string;
}
export interface WorkspaceScore {
  bidId: string;
  criterionId: string;
  score: number | null;
  motivation: string;
  status: "concept" | "ingediend" | null;
}

/**
 * Assessor workspace: one criterion at a time (tabs), progress per criterion,
 * guideline always visible, AI advice gated on own submitted score. Prices are
 * deliberately not shown here (two-phase assessment).
 */
export function AssessorWorkspace({
  tenderId,
  criteria,
  bids,
  scores,
  advice,
  adviceBefore,
  save,
}: {
  tenderId: string;
  criteria: WorkspaceCriterion[];
  bids: WorkspaceBid[];
  scores: WorkspaceScore[];
  advice: Array<AiAdviceData & { bidId: string; criterionId: string }>;
  adviceBefore: boolean;
  save: (tenderId: string, bidId: string, criterionId: string, score: number, motivation: string, submit: boolean) => Promise<ActionResult<unknown>>;
}) {
  const [active, setActive] = useState(criteria[0]?.id ?? "");
  const progress = useMemo(
    () =>
      Object.fromEntries(
        criteria.map((c) => {
          const own = scores.filter((s) => s.criterionId === c.id);
          return [c.id, { submitted: own.filter((s) => s.status === "ingediend").length, concept: own.filter((s) => s.status === "concept").length, total: bids.length }];
        }),
      ),
    [criteria, scores, bids.length],
  );
  const crit = criteria.find((c) => c.id === active) ?? criteria[0];
  if (!crit) return <p className="text-sm text-muted-foreground">Geen criteria.</p>;
  const p = progress[crit.id]!;

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <nav className="space-y-1 lg:sticky lg:top-4 lg:self-start" aria-label="Criteria">
        {criteria.map((c) => {
          const pr = progress[c.id]!;
          const done = pr.submitted === pr.total && pr.total > 0;
          const Icon = done ? CheckCircle2 : pr.submitted + pr.concept > 0 ? CircleDot : Circle;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActive(c.id)}
              className={cn("flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors", c.id === crit.id ? "border-ai-blue bg-accent" : "bg-background hover:bg-muted")}
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", done ? "text-emerald-600" : c.id === crit.id ? "text-ai-blue" : "text-muted-foreground")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  <span className="font-mono text-xs text-muted-foreground">{c.code}</span> {c.name}
                </span>
                <span className="block font-mono text-[11px] text-muted-foreground">
                  {pr.submitted}/{pr.total} ingediend{pr.concept ? `, ${pr.concept} concept` : ""} | weging {c.weight}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
      <div className="space-y-4">
        <div className="rounded-lg border bg-background p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-heading text-lg font-semibold">
                <span className="font-mono text-sm text-muted-foreground">{crit.code}</span> {crit.name}
              </h2>
              <p className="text-sm text-muted-foreground">{crit.description}</p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              weging {crit.weight} | schaal 0-{crit.maxScore} | {p.submitted}/{p.total} ingediend
            </span>
          </div>
          <details className="mt-3 rounded-md bg-muted/60 p-3 text-sm" open>
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">Beoordelingsrichtlijn</summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed">{crit.guideline}</pre>
          </details>
        </div>
        {bids.map((b, i) => {
          const mine = scores.find((s) => s.bidId === b.id && s.criterionId === crit.id);
          const ai = advice.find((a) => a.bidId === b.id && a.criterionId === crit.id);
          const showAi = adviceBefore || mine?.status === "ingediend";
          return (
            <section key={b.id} className="rounded-lg border bg-background p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-heading text-base font-semibold">
                  <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-navy font-mono text-xs text-white">{i + 1}</span>
                  {b.bidderName}
                </h3>
                <Button size="sm" variant="outline" render={<Link href={`/aanbestedingen/${tenderId}/inschrijvingen/${b.id}`} target="_blank">Documenten bekijken</Link>} />
              </div>
              <ScoreForm tenderId={tenderId} bidId={b.id} criterionId={crit.id} maxScore={crit.maxScore} initial={{ score: mine?.score ?? null, motivation: mine?.motivation ?? "", status: mine?.status ?? null }} save={save} />
              {ai && showAi ? (
                <div className="mt-3">
                  <AiAdvicePanel advice={ai} maxScore={crit.maxScore} bidHref={`/aanbestedingen/${tenderId}/inschrijvingen/${b.id}`} />
                </div>
              ) : ai ? (
                <p className="mt-2 text-xs text-muted-foreground">Het AI-advies (niet bindend) verschijnt na het indienen van uw eigen score.</p>
              ) : null}
            </section>
          );
        })}
        <div className="flex justify-between">
          <Button variant="outline" disabled={criteria.indexOf(crit) === 0} onClick={() => setActive(criteria[criteria.indexOf(crit) - 1]!.id)}>
            Vorig criterium
          </Button>
          <Button variant="outline" disabled={criteria.indexOf(crit) === criteria.length - 1} onClick={() => setActive(criteria[criteria.indexOf(crit) + 1]!.id)}>
            Volgend criterium
          </Button>
        </div>
      </div>
    </div>
  );
}
