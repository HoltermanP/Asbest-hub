import type { DiffPart } from "@/lib/documents/diff";
import { cn } from "@/lib/utils";

export function DiffView({ parts }: { parts: DiffPart[] }) {
  return (
    <pre className="max-h-[70vh] overflow-auto rounded-md border bg-background p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
      {parts.map((p, i) => (
        <span key={i} className={cn(p.type === "added" && "bg-emerald-100 text-emerald-900", p.type === "removed" && "bg-red-100 text-red-900 line-through")}>
          {p.text}
        </span>
      ))}
    </pre>
  );
}
