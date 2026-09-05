import { addWorkingDays } from "./deadlines";
import { toIsoDate } from "./format";

export interface PlanItemInput {
  key: string;
  name: string;
  durationDays: number;
  dependsOn: string[];
  responsible: string | null;
}

export interface PlanItemComputed extends PlanItemInput {
  startDate: string;
  endDate: string;
  isCritical: boolean;
  order: number;
}

/**
 * Critical path method over working days. Items start on the project start
 * date or after all predecessors finish. Critical items have zero total float.
 */
export function computeSchedule(items: PlanItemInput[], projectStart: Date): PlanItemComputed[] {
  const byKey = new Map(items.map((i) => [i.key, i]));
  for (const it of items) {
    for (const d of it.dependsOn) if (!byKey.has(d)) throw new Error(`Activiteit ${it.key} verwijst naar onbekende afhankelijkheid ${d}`);
  }
  const order = topoSort(items);
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const key of order) {
    const it = byKey.get(key)!;
    const start = Math.max(0, ...it.dependsOn.map((d) => ef.get(d) ?? 0));
    es.set(key, start);
    ef.set(key, start + Math.max(1, it.durationDays));
  }
  const projectEnd = Math.max(0, ...[...ef.values()]);
  const lf = new Map<string, number>();
  const ls = new Map<string, number>();
  const successors = new Map<string, string[]>();
  for (const it of items) for (const d of it.dependsOn) successors.set(d, [...(successors.get(d) ?? []), it.key]);
  for (const key of [...order].reverse()) {
    const it = byKey.get(key)!;
    const succ = successors.get(key) ?? [];
    const finish = succ.length === 0 ? projectEnd : Math.min(...succ.map((s) => ls.get(s)!));
    lf.set(key, finish);
    ls.set(key, finish - Math.max(1, it.durationDays));
  }
  return order.map((key, idx) => {
    const it = byKey.get(key)!;
    const s = es.get(key)!;
    const f = ef.get(key)!;
    const float = ls.get(key)! - s;
    const startDate = addWorkingDays(projectStart, s);
    const endDate = addWorkingDays(projectStart, Math.max(s, f - 1));
    return { ...it, startDate: toIsoDate(startDate), endDate: toIsoDate(endDate), isCritical: float === 0, order: idx };
  });
}

function topoSort(items: PlanItemInput[]): string[] {
  const visited = new Set<string>();
  const temp = new Set<string>();
  const out: string[] = [];
  const byKey = new Map(items.map((i) => [i.key, i]));
  function visit(key: string) {
    if (visited.has(key)) return;
    if (temp.has(key)) throw new Error(`Cyclische afhankelijkheid bij ${key}`);
    temp.add(key);
    for (const d of byKey.get(key)!.dependsOn) visit(d);
    temp.delete(key);
    visited.add(key);
    out.push(key);
  }
  for (const it of items) visit(it.key);
  return out;
}

export function criticalPath(items: PlanItemComputed[]): string[] {
  return items.filter((i) => i.isCritical).map((i) => i.key);
}
