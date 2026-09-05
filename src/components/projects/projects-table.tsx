"use client";

import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { OBJECT_TYPE_LABELS, PROJECT_STATUS_LABELS } from "@/lib/labels";

export interface ProjectRow {
  id: string;
  name: string;
  projectNumber: string;
  client: string;
  status: string;
  objectType: string;
  riskClass: string | null;
  plaats: string;
  plannedStart: string | null;
  budget: string | null;
  isDemo: boolean;
}

const columns: Column<ProjectRow>[] = [
  { key: "nr", header: "Nummer", sortValue: (r) => r.projectNumber, render: (r) => <span className="font-mono text-xs">{r.projectNumber}</span> },
  { key: "name", header: "Project", sortValue: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span>, filterValue: (r) => `${r.name} ${r.client} ${r.plaats}` },
  { key: "client", header: "Opdrachtgever", sortValue: (r) => r.client, render: (r) => r.client },
  { key: "type", header: "Object", sortValue: (r) => r.objectType, render: (r) => OBJECT_TYPE_LABELS[r.objectType] ?? r.objectType },
  { key: "rk", header: "RK", sortValue: (r) => r.riskClass ?? "", render: (r) => (r.riskClass ? <StatusBadge value={r.riskClass} label={r.riskClass} /> : "-") },
  { key: "status", header: "Status", sortValue: (r) => r.status, render: (r) => <StatusBadge value={r.status} label={PROJECT_STATUS_LABELS[r.status]} /> },
  { key: "start", header: "Start", sortValue: (r) => r.plannedStart ?? "", render: (r) => <span className="font-mono text-xs">{formatDate(r.plannedStart)}</span> },
  { key: "budget", header: "Budget", sortValue: (r) => Number(r.budget ?? 0), render: (r) => <span className="font-mono text-xs">{formatCurrency(r.budget)}</span>, className: "text-right" },
];

export function ProjectsTable({ rows }: { rows: ProjectRow[] }) {
  return <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} onRowHref={(r) => `/projecten/${r.id}`} searchPlaceholder="Zoek op naam, opdrachtgever of plaats" initialSort={{ key: "nr", dir: "asc" }} />;
}
