"use client";

import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { TENDER_STATUS_LABELS } from "@/lib/labels";
import { PROCEDURE_LABELS } from "@/lib/thresholds";

export interface TenderRow {
  id: string;
  title: string;
  referenceNumber: string;
  projectName: string;
  procedure: string;
  status: string;
  estimatedValue: string;
  sluiting: string | null;
  bids: number;
}

const columns: Column<TenderRow>[] = [
  { key: "ref", header: "Kenmerk", sortValue: (r) => r.referenceNumber, render: (r) => <span className="font-mono text-xs">{r.referenceNumber}</span> },
  { key: "title", header: "Aanbesteding", sortValue: (r) => r.title, render: (r) => <span className="font-medium">{r.title}</span>, filterValue: (r) => `${r.title} ${r.projectName}` },
  { key: "project", header: "Project", sortValue: (r) => r.projectName, render: (r) => r.projectName },
  { key: "proc", header: "Procedure", sortValue: (r) => r.procedure, render: (r) => PROCEDURE_LABELS[r.procedure as keyof typeof PROCEDURE_LABELS] ?? r.procedure },
  { key: "status", header: "Status", sortValue: (r) => r.status, render: (r) => <StatusBadge value={r.status} label={TENDER_STATUS_LABELS[r.status]} /> },
  { key: "value", header: "Raming", sortValue: (r) => Number(r.estimatedValue), render: (r) => <span className="font-mono text-xs">{formatCurrency(r.estimatedValue)}</span>, className: "text-right" },
  { key: "sluiting", header: "Sluiting", sortValue: (r) => r.sluiting ?? "", render: (r) => <span className="font-mono text-xs">{formatDate(r.sluiting)}</span> },
  { key: "bids", header: "Inschr.", sortValue: (r) => r.bids, render: (r) => <span className="font-mono text-xs">{r.bids}</span>, className: "text-right" },
];

export function TendersTable({ rows }: { rows: TenderRow[] }) {
  return <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} onRowHref={(r) => `/aanbestedingen/${r.id}`} searchPlaceholder="Zoek op titel of project" initialSort={{ key: "ref", dir: "asc" }} />;
}
