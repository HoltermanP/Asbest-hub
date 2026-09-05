"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar";

export function AppShell({
  children,
  openApprovals,
  roleLabel,
}: {
  children: React.ReactNode;
  openApprovals: number;
  roleLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/zoeken?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <Link href="/projecten" className="flex h-14 items-center border-b border-sidebar-border px-5 font-heading text-lg font-semibold text-white">
          AsbestHub
        </Link>
        <SidebarNav openApprovals={openApprovals} />
        <div className="mt-auto border-t border-sidebar-border p-4 font-mono text-[11px] text-sidebar-foreground/60">
          Rol: {roleLabel}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b bg-background px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
                  <Menu className="size-5" />
                </Button>
              }
            />
            <SheetContent side="left" className="w-64 bg-sidebar p-0 text-sidebar-foreground">
              <SheetTitle className="px-5 py-4 font-heading text-white">AsbestHub</SheetTitle>
              <SidebarNav openApprovals={openApprovals} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <form onSubmit={submitSearch} className="relative hidden max-w-md flex-1 sm:block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Zoek projecten, aanbestedingen, kennisbank..."
              className="pl-9"
              aria-label="Zoeken"
            />
          </form>
          <div className="ml-auto flex items-center gap-3">
            <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/projecten" afterCreateOrganizationUrl="/projecten" />
            <UserButton />
          </div>
        </header>
        <main className="flex-1 bg-muted/40 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
