import { OrganizationList } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function OrganisationPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted p-6">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-semibold">Kies een organisatie</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          AsbestHub werkt per organisatie (opdrachtgever). Selecteer of maak een organisatie om verder te gaan.
        </p>
      </div>
      <OrganizationList hidePersonal afterSelectOrganizationUrl="/projecten" afterCreateOrganizationUrl="/projecten" />
    </div>
  );
}
