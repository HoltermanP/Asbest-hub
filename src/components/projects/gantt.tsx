import { daysBetween } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface GanttItem {
  key: string;
  name: string;
  startDate: string;
  endDate: string;
  isCritical: boolean;
  responsible: string | null;
  dependsOn: string[];
}

/** Lightweight CSS gantt: one row per item, bar positioned by day offset. */
export function Gantt({ items }: { items: GanttItem[] }) {
  if (items.length === 0) return null;
  const start = items.reduce((min, i) => (i.startDate < min ? i.startDate : min), items[0]!.startDate);
  const end = items.reduce((max, i) => (i.endDate > max ? i.endDate : max), items[0]!.endDate);
  const total = Math.max(1, daysBetween(start, end) + 1);
  const weeks = Math.ceil(total / 7);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[220px_1fr] border-b text-xs text-muted-foreground">
          <div className="px-2 py-1">Activiteit</div>
          <div className="relative h-6">
            {Array.from({ length: weeks }).map((_, w) => (
              <div key={w} className="absolute top-0 h-full border-l px-1 font-mono" style={{ left: `${((w * 7) / total) * 100}%` }}>
                wk {w + 1}
              </div>
            ))}
          </div>
        </div>
        {items.map((it) => {
          const left = (daysBetween(start, it.startDate) / total) * 100;
          const width = Math.max(1, ((daysBetween(it.startDate, it.endDate) + 1) / total) * 100);
          return (
            <div key={it.key} className="grid grid-cols-[220px_1fr] items-center border-b text-xs">
              <div className="truncate px-2 py-1.5" title={`${it.name} (${it.key})`}>
                <span className={cn(it.isCritical && "font-semibold")}>{it.name}</span>
                {it.responsible ? <span className="block text-[10px] text-muted-foreground">{it.responsible}</span> : null}
              </div>
              <div className="relative h-7">
                <div
                  className={cn("absolute top-1.5 h-4 rounded-sm", it.isCritical ? "bg-velocity" : "bg-ai-blue/70")}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${it.startDate} t/m ${it.endDate}${it.dependsOn.length ? ` (na ${it.dependsOn.join(", ")})` : ""}`}
                />
              </div>
            </div>
          );
        })}
        <p className="mt-2 text-[11px] text-muted-foreground">
          <span className="inline-block size-2 rounded-sm bg-velocity align-middle" /> kritiek pad{" "}
          <span className="ml-3 inline-block size-2 rounded-sm bg-ai-blue/70 align-middle" /> overige activiteiten. Periode {start} t/m {end}.
        </p>
      </div>
    </div>
  );
}
