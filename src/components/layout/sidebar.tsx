"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CheckSquare, ClipboardList, FolderKanban, Gavel, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/projecten", label: "Projecten", icon: FolderKanban },
  { href: "/aanbestedingen", label: "Aanbestedingen", icon: Gavel },
  { href: "/beoordelen", label: "Beoordelingen", icon: ClipboardList },
  { href: "/kennisbank", label: "Kennisbank", icon: BookOpen },
  { href: "/accorderingen", label: "Accorderingen", icon: CheckSquare },
  { href: "/instellingen", label: "Instellingen", icon: Settings },
] as const;

export function SidebarNav({ openApprovals, onNavigate }: { openApprovals: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-white",
              active && "bg-sidebar-primary text-white hover:bg-sidebar-primary",
            )}
          >
            <Icon className="size-4" />
            <span className="flex-1">{item.label}</span>
            {item.href === "/accorderingen" && openApprovals > 0 ? (
              <span className="rounded-full bg-velocity px-2 py-0.5 font-mono text-xs text-white">{openApprovals}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
