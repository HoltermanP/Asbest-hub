"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { seg: "", label: "Overzicht" },
  { seg: "fasen", label: "Fasen" },
  { seg: "onderzoeken", label: "Onderzoeken en bronnen" },
  { seg: "vergunningen", label: "Vergunningen" },
  { seg: "documenten", label: "Documenten" },
  { seg: "calculatie", label: "Calculatie" },
  { seg: "planning", label: "Planning" },
  { seg: "betrokkenen", label: "Betrokkenen" },
  { seg: "aanbesteding", label: "Aanbesteding" },
];

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projecten/${projectId}`;
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b" aria-label="Projecttabs">
      {TABS.map((t) => {
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
