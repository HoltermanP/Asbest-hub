import { expect, test } from "@playwright/test";
import { aiEnabled, approveFirst, e2eEnabled, uniqueSuffix, waitForJob } from "./helpers";

/**
 * Flow 2: aanbesteding opzetten -> stukken genereren -> publicatiepakket.
 */
test.describe("Aanbestedingsflow", () => {
  test.skip(!e2eEnabled, "Clerk e2e-gebruiker niet geconfigureerd");

  test("aanbesteding opzetten, criteria en stukken accorderen, publicatiepakket maken", async ({ page }) => {
    const suffix = uniqueSuffix();
    await page.goto("/aanbestedingen/nieuw");
    await page.getByLabel("Kenmerk").fill(`E2E-AANB-${suffix}`);
    await page.getByLabel("Geraamde waarde (EUR excl. btw)").fill("480000");
    await page.getByLabel("Publicatie").fill("2027-01-10");
    await page.getByLabel("Nota van Inlichtingen").fill("2027-02-01");
    await page.getByLabel("Sluiting inschrijving").fill("2027-02-20");
    if (!aiEnabled) await page.getByLabel(/AI-voorstel voor procedure/).uncheck();
    await page.getByRole("button", { name: "Aanbesteding aanmaken" }).click();
    await page.waitForURL(/\/aanbestedingen\/[0-9a-f-]+$/);
    const tenderUrl = page.url();
    await expect(page.getByText("Meervoudig onderhands").first()).toBeVisible();

    if (aiEnabled) await waitForJob(page);
    else {
      await page.getByRole("button", { name: "Opzet ter accordering" }).click();
      await expect(page.getByText(/Accorderingsverzoek aangemaakt/)).toBeVisible();
      await page.reload();
    }
    await approveFirst(page);
    await expect(page.getByText(/Geaccordeerd \d/)).toBeVisible();

    // Criteria
    await page.goto(`${tenderUrl}/criteria`);
    if (!aiEnabled) {
      for (const [code, name, weight, price] of [["C1", "Prijs", "40", true], ["C2", "Plan van aanpak", "60", false]] as const) {
        await page.getByRole("button", { name: "Criterium toevoegen" }).click();
        await page.getByLabel("Code").fill(code);
        await page.getByLabel("Naam").fill(name);
        await page.getByLabel("Weging (punten)").fill(weight);
        if (price) await page.getByLabel("Prijscriterium").selectOption("1");
        await page.getByLabel("Omschrijving (wat wordt beoordeeld)").fill(`Omschrijving ${name}`);
        await page.getByLabel("Beoordelingsrichtlijn (per scoreniveau)").fill("10 uitstekend, 6 voldoende, 2 onvoldoende");
        await page.getByRole("button", { name: "Opslaan" }).click();
        await expect(page.getByText(`Omschrijving ${name}`)).toBeVisible();
      }
      await page.getByRole("button", { name: "Ter accordering aanbieden" }).click();
      await page.reload();
    }
    await expect(page.getByText("Wegingen: 100 / 100")).toBeVisible();
    await approveFirst(page);

    // Documents
    await page.goto(`${tenderUrl}/stukken`);
    if (aiEnabled) {
      await page.getByRole("button", { name: /Genereer stuk \(AI\)/ }).click();
      await page.getByRole("button", { name: "Start generatie" }).click();
      await waitForJob(page);
    } else {
      await page.getByRole("link", { name: "Handmatig opstellen" }).click();
      await page.waitForURL(/\/stukken\/nieuw/);
      await page.getByLabel("Documenttype").selectOption("aanbestedingsleidraad");
      await page.getByLabel("Titel").fill("Aanbestedingsleidraad E2E");
      await page.locator(".asbesthub-editor").click();
      await page.keyboard.type("Inleiding");
      await page.getByRole("button", { name: "Hoofdstuk (kop 1)" }).click();
      await page.keyboard.press("End");
      await page.keyboard.press("Enter");
      await page.keyboard.type("Leidraad voor de e2e-test.");
      await page.getByRole("button", { name: "Document opslaan" }).click();
      await page.waitForURL(/\/stukken\/[0-9a-f-]+$/);
      await page.goto(`${tenderUrl}/stukken`);
      await expect(page.getByText("Aanbestedingsleidraad E2E")).toBeVisible();
      await page.getByRole("button", { name: "Ter accordering aanbieden" }).first().click();
      await page.reload();
    }
    await approveFirst(page);
    await expect(page.getByText("Geaccordeerd").first()).toBeVisible();

    // Publication package
    await page.goto(`${tenderUrl}/publicatiepakket`);
    await expect(page.getByText("Geen directe koppeling met TenderNed")).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Maak publicatiepakket" }).click()]);
    expect(download.suggestedFilename()).toMatch(/publicatiepakket_.*\.zip/);
  });
});
