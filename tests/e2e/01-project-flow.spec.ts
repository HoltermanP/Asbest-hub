import { expect, test } from "@playwright/test";
import path from "node:path";
import { aiEnabled, approveFirst, e2eEnabled, uniqueSuffix, waitForJob } from "./helpers";

/**
 * Flow 1: project aanmaken -> inventarisatie uploaden -> documenten genereren en accorderen.
 */
test.describe("Projectflow", () => {
  test.skip(!e2eEnabled, "Clerk e2e-gebruiker niet geconfigureerd");

  test("project aanmaken, inventarisatie uploaden, document genereren en accorderen", async ({ page }) => {
    const suffix = uniqueSuffix();
    await page.goto("/projecten/nieuw");
    await page.getByLabel("Projectnaam").fill(`E2E project ${suffix}`);
    await page.getByLabel("Projectnummer").fill(`E2E-${suffix}`);
    await page.getByLabel("Opdrachtgever").fill("E2E opdrachtgever");
    await page.getByLabel("Adres").fill("Teststraat 1");
    await page.getByLabel("Plaats").fill("Teststad");
    await page.getByLabel("Gemeente (bevoegd gezag)").fill("Teststad");
    await page.getByLabel("Geplande start uitvoering").fill("2027-03-01");
    await page.getByRole("button", { name: "Project aanmaken" }).click();
    await page.waitForURL(/\/projecten\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: `E2E project ${suffix}` })).toBeVisible();
    const projectUrl = page.url();

    // Phases seeded automatically
    await page.goto(`${projectUrl}/fasen`);
    await expect(page.getByText("1. Initiatief")).toBeVisible();
    await page.getByRole("checkbox").first().click();

    // Investigation upload with extraction
    await page.goto(`${projectUrl}/onderzoeken`);
    await page.getByRole("button", { name: "Onderzoek toevoegen" }).click();
    await page.getByLabel("Uitvoerend bureau").fill("E2E Inventarisatiebureau");
    await page.getByLabel("Rapportdatum").fill("2026-01-15");
    await page.locator('input[name="file"]').setInputFiles(path.join(process.cwd(), "tests", "e2e", "fixtures", "inventarisatie.pdf"));
    if (!aiEnabled) await page.getByLabel(/Direct bronnenlijst laten extraheren/).uncheck();
    await page.getByRole("button", { name: "Opslaan" }).click();
    await expect(page.getByText("E2E Inventarisatiebureau")).toBeVisible();

    if (aiEnabled) {
      await waitForJob(page);
      await expect(page.getByText(/Concept \(te controleren\)/)).toBeVisible();
      await approveFirst(page);
      await expect(page.getByText("Geaccordeerd").first()).toBeVisible();
    } else {
      await page.getByRole("button", { name: "Bron toevoegen" }).click();
      await page.getByLabel("Code").fill("B01");
      await page.getByLabel("Locatie in object").fill("Cv-ruimte");
      await page.getByLabel("Materiaal / toepassing").fill("Asbestcement plaat");
      await page.getByLabel("Hoeveelheid").fill("12");
      await page.getByLabel("Saneringsmethode").fill("Containment");
      await page.getByRole("button", { name: "Opslaan" }).click();
      await expect(page.getByText("Asbestcement plaat")).toBeVisible();
    }

    // Document: AI generation when available, otherwise manual; then approval.
    await page.goto(`${projectUrl}/documenten`);
    if (aiEnabled) {
      await page.getByRole("button", { name: /Genereer met AI/ }).click();
      await page.getByRole("button", { name: "Start generatie" }).click();
      await waitForJob(page);
      await expect(page.getByText(/Projectplan/).first()).toBeVisible();
    } else {
      await page.getByRole("link", { name: "Handmatig opstellen" }).click();
      await page.waitForURL(/\/documenten\/nieuw/);
      await page.getByLabel("Titel").fill("Projectplan E2E");
      const editor = page.locator(".asbesthub-editor");
      await editor.click();
      await page.keyboard.type("Inleiding");
      await page.getByRole("button", { name: "Hoofdstuk (kop 1)" }).click();
      await page.keyboard.press("End");
      await page.keyboard.press("Enter");
      await page.keyboard.type("Dit is een e2e-projectplan met een opsomming.");
      await page.getByRole("button", { name: "Document opslaan" }).click();
      await page.waitForURL(/\/documenten\/[0-9a-f-]+$/);
      await expect(page.getByText("Projectplan E2E").first()).toBeVisible();
      await page.goto(`${projectUrl}/documenten`);
      await page.getByRole("button", { name: "Ter accordering aanbieden" }).first().click();
      await expect(page.getByText(/Accorderingsverzoek aangemaakt/)).toBeVisible();
    }
    await page.reload();
    await approveFirst(page);
    await expect(page.getByText("Geaccordeerd").first()).toBeVisible();

    // Dossier export contains the approved document
    const download = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /Dossier exporteren/ }).click()]);
    expect(download[0].suggestedFilename()).toMatch(/projectdossier_.*\.zip/);
  });
});
