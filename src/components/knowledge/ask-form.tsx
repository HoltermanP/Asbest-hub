"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SourcesList } from "@/components/shared/sources-list";
import { ConfidenceBadge } from "@/components/shared/status-badge";
import type { ActionResult } from "@/lib/action-result";
import type { KnowledgeAnswer } from "@/actions/knowledge";
import type { AiSource } from "@/db/schema";
import { cn } from "@/lib/utils";

export function AskForm({ ask, suggestions }: { ask: (q: string) => Promise<ActionResult<KnowledgeAnswer>>; suggestions: string[] }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<KnowledgeAnswer | null>(null);
  const [pending, start] = useTransition();
  function submit(q: string) {
    if (q.trim().length < 3) return;
    setQuestion(q);
    start(async () => {
      const res = await ask(q);
      if (res.ok) setAnswer(res.data);
      else toast.error(res.error);
    });
  }
  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
        className="space-y-2"
      >
        <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} placeholder="Bijv. Welke termijn geldt voor de sloopmelding bij een woningcomplex met risicoklasse 2?" />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Vraag stellen
          </Button>
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => submit(s)} className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted">
              {s}
            </button>
          ))}
        </div>
      </form>
      {answer ? (
        <div className={cn("rounded-lg border bg-background p-4", answer.confidence === "laag" && "border-yellow-300 bg-yellow-50/50")}>
          <div className="mb-2 flex items-center gap-2">
            <ConfidenceBadge value={answer.confidence} />
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{answer.answer}</p>
          <div className="mt-4 border-t pt-3">
            <p className="mb-1 text-xs font-medium">Bronnen</p>
            <SourcesList sources={answer.sources as AiSource[]} />
          </div>
          {answer.followUps.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {answer.followUps.map((f) => (
                <button key={f} type="button" onClick={() => submit(f)} className="rounded-full border border-ai-blue/40 px-3 py-1 text-xs text-ai-blue hover:bg-accent">
                  {f}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
