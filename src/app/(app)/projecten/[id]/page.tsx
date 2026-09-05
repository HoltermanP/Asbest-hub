import Link from "next/link";
import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import { KeyValue, Section } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { requirePermission } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS, PHASE_STATUS_LABELS } from "@/lib/labels";
import { loadProjectBundle } from "@/lib/project-data";
import { projectDashboard } from "@/lib/queries/project-dashboard";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ICONS = { kritiek: OctagonAlert, waarschuwing: AlertTriangle, info: Info } as const;

export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("project:read");
  const b = await loadProjectBundle(ctx.orgId, id);
  const dash = await projectDashboard(b);
  const p = b.project;
  const currentPhase = b.phases.find((ph) => ph.status === "bezig") ?? b.phases.find((ph) => ph.status === "open");
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Section title="Wat moet er gebeuren" description="Openstaande accorderingen, deadlines, ontbrekende documenten en risico's.">
          {dash.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen openstaande punten.</p>
          ) : (
            <ul className="divide-y">
              {dash.items.map((it, i) => {
                const Icon = ICONS[it.severity];
                return (
                  <li key={i}>
                    <Link href={it.href} className="flex items-start gap-3 py-2 hover:bg-muted/50">
                      <Icon className={cn("mt-0.5 size-4 shrink-0", it.severity === "kritiek" ? "text-velocity" : it.severity === "waarschuwing" ? "text-amber-600" : "text-ai-blue")} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{it.title}</p>
                        <p className="text-xs text-muted-foreground">{it.detail}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
        <Section title="Projectgegevens">
          <KeyValue
            items={[
              { label: "Opdrachtgever", value: p.client },
              { label: "Locatie", value: `${p.location.adres}, ${p.location.postcode} ${p.location.plaats}` },
              { label: "Gemeente", value: p.location.gemeente },
              { label: "Bouwjaar", value: p.constructionYear ?? "-" },
              { label: "Budget", value: <span className="font-mono">{formatCurrency(p.budget)}</span> },
              { label: "Calculatie", value: <span className="font-mono">{dash.calculationTotal ? formatCurrency(dash.calculationTotal) : "-"}</span> },
              { label: "Geplande start", value: <span className="font-mono">{formatDate(p.plannedStart)}</span> },
              { label: "Geplande oplevering", value: <span className="font-mono">{formatDate(p.plannedEnd)}</span> },
              { label: "Huidige fase", value: currentPhase ? `${currentPhase.name} (${PHASE_STATUS_LABELS[currentPhase.status]})` : "-" },
              { label: "Bronnen", value: `${b.sources.length} (${b.sources.filter((s) => s.approved).length} geaccordeerd)` },
              { label: "Contact", value: p.contacts[0] ? `${p.contacts[0].naam} (${p.contacts[0].rol})` : "-" },
              { label: "Aanbesteding", value: dash.tender ? <Link className="text-ai-blue hover:underline" href={`/aanbestedingen/${dash.tender.id}`}>{dash.tender.title}</Link> : "Nog niet gestart" },
            ]}
          />
          {p.description ? <p className="mt-4 text-sm text-muted-foreground">{p.description}</p> : null}
        </Section>
      </div>
      <div className="space-y-4">
        <Section title="Fasen">
          <ol className="space-y-1.5">
            {b.phases.map((ph) => {
              const done = ph.checklist.filter((c) => c.done).length;
              return (
                <li key={ph.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className={cn(ph.status === "afgerond" && "text-muted-foreground")}>{ph.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {done}/{ph.checklist.length}
                    </span>
                    <StatusBadge value={ph.status} label={PHASE_STATUS_LABELS[ph.status]} />
                  </span>
                </li>
              );
            })}
          </ol>
        </Section>
        <Section title="Documenten">
          {b.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen documenten.</p>
          ) : (
            <ul className="space-y-1.5">
              {b.documents
                .filter((d) => d.status !== "verouderd")
                .map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/projecten/${p.id}/documenten/${d.id}`} className="truncate hover:underline">
                      {DOCUMENT_TYPE_LABELS[d.type]} v{d.version}
                    </Link>
                    <StatusBadge value={d.status} label={DOCUMENT_STATUS_LABELS[d.status]} />
                  </li>
                ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
