import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  concept: "bg-muted text-foreground border-border",
  ter_accordering: "bg-amber-50 text-amber-900 border-amber-200",
  geaccordeerd: "bg-emerald-50 text-emerald-800 border-emerald-200",
  verouderd: "bg-muted text-muted-foreground border-border line-through",
  open: "bg-muted text-foreground border-border",
  bezig: "bg-blue-50 text-blue-900 border-blue-200",
  afgerond: "bg-emerald-50 text-emerald-800 border-emerald-200",
  gereed: "bg-emerald-50 text-emerald-800 border-emerald-200",
  mislukt: "bg-red-50 text-red-800 border-red-200",
  wachtrij: "bg-muted text-foreground border-border",
  voorgesteld: "bg-amber-50 text-amber-900 border-amber-200",
  voorbereiden: "bg-blue-50 text-blue-900 border-blue-200",
  ingediend: "bg-blue-50 text-blue-900 border-blue-200",
  geaccepteerd: "bg-emerald-50 text-emerald-800 border-emerald-200",
  afgewezen: "bg-red-50 text-red-800 border-red-200",
  niet_nodig: "bg-muted text-muted-foreground border-border",
  geen: "bg-muted text-muted-foreground border-border",
  uitgesloten: "bg-red-50 text-red-800 border-red-200",
  geldig: "bg-emerald-50 text-emerald-800 border-emerald-200",
  ontvangen: "bg-muted text-foreground border-border",
  gecontroleerd: "bg-blue-50 text-blue-900 border-blue-200",
  ingetrokken: "bg-muted text-muted-foreground border-border",
  gegund: "bg-emerald-50 text-emerald-800 border-emerald-200",
  beoordeling: "bg-blue-50 text-blue-900 border-blue-200",
  gepubliceerd: "bg-blue-50 text-blue-900 border-blue-200",
  ingediend_score: "bg-emerald-50 text-emerald-800 border-emerald-200",
  goedgekeurd: "bg-emerald-50 text-emerald-800 border-emerald-200",
  "1": "bg-emerald-50 text-emerald-800 border-emerald-200",
  "2": "bg-amber-50 text-amber-900 border-amber-200",
  "2A": "bg-red-50 text-red-800 border-red-200",
};

export function StatusBadge({ value, label, className }: { value: string; label?: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-mono text-[11px] font-medium", TONES[value] ?? "bg-muted", className)}>
      {label ?? value}
    </Badge>
  );
}

export function ConfidenceBadge({ value }: { value: "laag" | "middel" | "hoog" | null | undefined }) {
  if (!value) return null;
  const tone = value === "laag" ? "bg-yellow-100 text-yellow-900 border-yellow-300" : value === "middel" ? "bg-blue-50 text-blue-900 border-blue-200" : "bg-emerald-50 text-emerald-800 border-emerald-200";
  const label = value === "laag" ? "Lage betrouwbaarheid" : value === "middel" ? "Gemiddelde betrouwbaarheid" : "Hoge betrouwbaarheid";
  return (
    <Badge variant="outline" className={cn("font-mono text-[11px]", tone)}>
      {label}
    </Badge>
  );
}

export function AiAdviceTag() {
  return (
    <Badge variant="outline" className="border-ai-blue/40 bg-ai-blue/10 font-mono text-[11px] text-ai-blue">
      AI-advies, niet bindend
    </Badge>
  );
}
