import { OrganizationProfile } from "@clerk/nextjs";
import { Section } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth";
import { ROLE_LABELS, ROLES } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function UsersSettingsPage() {
  await requirePermission("settings:read");
  return (
    <div className="space-y-4">
      <Section title="Rollen" description="Rollen worden beheerd in Clerk Organizations. Maak in het Clerk-dashboard de rollen aan met exact deze sleutels.">
        <ul className="grid gap-2 text-sm md:grid-cols-2">
          {ROLES.map((r) => (
            <li key={r} className="rounded-md border p-2">
              <span className="font-mono text-xs">org:{r}</span> - {ROLE_LABELS[r]}
              <span className="block text-xs text-muted-foreground">
                {r === "admin" ? "beheert organisatie, gebruikers, sjablonen, kennisbank; accordeert" : r === "projectleider" ? "eigenaar van projecten en aanbestedingen; accordeert" : r === "beoordelaar" ? "beoordeelt toegewezen aanbestedingen" : r === "lezer" ? "alleen lezen" : "externe beoordelaar, alleen toegewezen aanbesteding"}
              </span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Leden en uitnodigingen">
        <OrganizationProfile routing="hash" />
      </Section>
    </div>
  );
}
