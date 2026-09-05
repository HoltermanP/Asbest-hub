import type { AiSource } from "@/db/schema";

export function SourcesList({ sources, compact }: { sources: AiSource[]; compact?: boolean }) {
  if (!sources || sources.length === 0) return <p className="text-xs text-muted-foreground">Geen bronnen vermeld.</p>;
  return (
    <ul className={compact ? "space-y-0.5 text-xs" : "space-y-1 text-sm"}>
      {sources.map((s, i) => (
        <li key={`${s.id}-${i}`} className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-[11px] text-muted-foreground">[{s.kind === "kennisbank" ? "K" : s.kind === "inschrijving" ? "I" : "D"}{i + 1}]</span>
          {s.url ? (
            <a href={s.url} target="_blank" rel="noreferrer" className="text-ai-blue underline-offset-2 hover:underline">
              {s.title}
            </a>
          ) : (
            <span>{s.title}</span>
          )}
          {s.page ? <span className="text-muted-foreground">p. {s.page}</span> : null}
          {!compact && s.excerpt ? <span className="block w-full text-xs text-muted-foreground">“{s.excerpt}”</span> : null}
        </li>
      ))}
    </ul>
  );
}
