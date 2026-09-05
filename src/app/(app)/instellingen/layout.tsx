import { PageHeader } from "@/components/shared/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Instellingen" };

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("settings:read");
  return (
    <div>
      <PageHeader title="Instellingen" description="Organisatie, gebruikers en rollen, sjablonen, prijzenboek, inkoopbeleid en AI-instellingen." />
      <SettingsNav />
      <div className="mt-4">{children}</div>
    </div>
  );
}
