"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/instellingen", label: "Organisatie" },
  { href: "/instellingen/gebruikers", label: "Gebruikers" },
  { href: "/instellingen/sjablonen", label: "Sjablonen" },
  { href: "/instellingen/prijzenboek", label: "Prijzenboek" },
  { href: "/instellingen/inkoopbeleid", label: "Inkoopbeleid en drempelwaarden" },
  { href: "/instellingen/ai", label: "AI-instellingen" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b" aria-label="Instellingen">
      {ITEMS.map((it) => {
        const active = it.href === "/instellingen" ? pathname === it.href : pathname.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm", active ? "border-ai-blue font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
