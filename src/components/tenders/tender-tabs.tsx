"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const TENDER_TABS = [
  { seg: "", label: "Opzet" },
  { seg: "criteria", label: "Criteria" },
  { seg: "stukken", label: "Stukken" },
  { seg: "nvi", label: "Nota van Inlichtingen" },
  { seg: "publicatiepakket", label: "Publicatiepakket" },
  { seg: "inschrijvingen", label: "Inschrijvingen" },
  { seg: "beoordeling", label: "Beoordeling" },
  { seg: "sessies", label: "Sessies" },
  { seg: "gunning", label: "Gunning" },
];

export function TenderTabs({ tenderId, visible }: { tenderId: string; visible?: string[] }) {
  const pathname = usePathname();
  const base = `/aanbestedingen/${tenderId}`;
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b" aria-label="Aanbestedingstabs">
      {TENDER_TABS.filter((t) => !visible || visible.includes(t.seg)).map((t) => {
        const href = t.seg ? `${base}/${t.seg}` : base;
        const active = t.seg ? pathname.startsWith(href) : pathname === base;
        return (
          <Link key={t.seg} href={href} className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm", active ? "border-ai-blue font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
