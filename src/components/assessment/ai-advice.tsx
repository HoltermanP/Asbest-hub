import Link from "next/link";
import { AiAdviceTag, ConfidenceBadge } from "@/components/shared/status-badge";
import type { AssessmentCitation } from "@/db/schema";
import { cn } from "@/lib/utils";

export interface AiAdviceData {
  score: string;
  rationale: string;
  citations: AssessmentCitation[];
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  clarificationQuestions: string[];
  confidence: "laag" | "middel" | "hoog";
}

export function AiAdvicePanel({ advice, maxScore, bidHref }: { advice: AiAdviceData; maxScore: number; bidHref: string }) {
  return (
    <div className={cn("space-y-2 rounded-md border border-ai-blue/30 bg-accent/60 p-3 text-sm", advice.confidence === "laag" && "border-yellow-300 bg-yellow-50")}>
      <div className="flex flex-wrap items-center gap-2">
        <AiAdviceTag />
        <ConfidenceBadge value={advice.confidence} />
        <span className="ml-auto font-mono text-sm font-semibold">
          {Number(advice.score)} / {maxScore}
        </span>
      </div>
      <p className="whitespace-pre-wrap">{advice.rationale}</p>
      {advice.citations.length ? (
        <div>
          <p className="text-xs font-medium">Citaten</p>
          <ul className="space-y-1 text-xs">
            {advice.citations.map((c, i) => (
              <li key={i}>
                <Link href={`${bidHref}?doc=${c.bidDocumentId ?? ""}&page=${c.pagina ?? 1}&q=${encodeURIComponent(c.tekst.slice(0, 80))}`} className="text-ai-blue hover:underline">
                  “{c.tekst}”
                </Link>{" "}
                <span className="text-muted-foreground">
                  ({c.bestand}
                  {c.pagina ? `, p. ${c.pagina}` : ""})
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="grid gap-2 text-xs md:grid-cols-2">
        {advice.strengths.length ? (
          <div>
            <p className="font-medium text-emerald-800">Sterke punten</p>
            <ul className="list-disc pl-4">{advice.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        ) : null}
        {advice.weaknesses.length ? (
          <div>
            <p className="font-medium text-amber-800">Zwakke punten</p>
            <ul className="list-disc pl-4">{advice.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        ) : null}
        {advice.risks.length ? (
          <div>
            <p className="font-medium text-velocity">Risico&apos;s</p>
            <ul className="list-disc pl-4">{advice.risks.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        ) : null}
        {advice.clarificationQuestions.length ? (
          <div>
            <p className="font-medium">Verduidelijkingsvragen</p>
            <ul className="list-disc pl-4">{advice.clarificationQuestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
