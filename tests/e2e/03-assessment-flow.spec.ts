import { expect, test } from "@playwright/test";
import path from "node:path";
import { aiEnabled, approveFirst, e2eEnabled, waitForJob } from "./helpers";

/**
 * Flow 3: inschrijvingen uploaden -> individueel beoordelen -> sessie -> gunningsadvies.
 * Uses the seeded demo tender (AANB-2026-001) so criteria and bids exist.
 */
test.describe("Beoordelingsflow", () => {
  test.skip(!e2eEnabled, "Clerk e2e-gebruiker niet geconfigureerd");

  test("inschrijving uploaden, scoren, sessie verwerken, consensus accorderen, gunningsadvies", async ({ page }) => {
    await page.goto("/aanbestedingen");
    await page.getByText("AANB-2026-001").click();
    await page.waitForURL(/\/aanbestedingen\/[0-9a-f-]+$/);
    const tenderUrl = page.url();
    const tenderId = tenderUrl.split("/").pop()!;

    // Upload an extra bid
    await page.goto(`${tenderUrl}/inschrijvingen`);
    await page.getByRole("button", { name: "Inschrijving uploaden" }).click();
    await page.getByLabel("Naam inschrijver").fill("E2E Saneringsbedrijf B.V. (fictief)");
    await page.getByLabel("Inschrijfsom (EUR excl. btw)").fill("430000");
    await page.locator('input[name="files"]').setInputFiles([path.join(process.cwd(), "tests", "e2e", "fixtures", "plan-van-aanpak.pdf")]);
    await page.getByRole("button", { name: "Registreren" }).click();
    await expect(page.getByText("E2E Saneringsbedrijf B.V. (fictief)")).toBeVisible();

    // Individual scoring: first quality criterion, first bid
    await page.goto(`/beoordelen/${tenderId}`);
    await expect(page.getByRole("heading", { name: /Beoordelen:/ })).toBeVisible();
    const firstScore = page.locator('input[id^="score-"]').first();
    await firstScore.fill("8");
    await page.locator('textarea[id^="mot-"]').first().fill("Concreet plan van aanpak met duidelijke fasering per blok en DTA-inzet.");
    await page.getByRole("button", { name: "Indienen (vergrendelen)" }).first().click();
    await expect(page.getByText(/Score ingediend en vergrendeld/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/Ingediend:/).first()).toBeVisible();

    if (aiEnabled) {
      await page.goto(`${tenderUrl}/beoordeling`);
      await page.getByRole("button", { name: "AI-advies genereren" }).click();
      await waitForJob(page, 600_000);
      await expect(page.getByText("AI-advies, niet bindend").first()).toBeVisible();
    }

    // Session with typed notes
    await page.goto(`${tenderUrl}/sessies`);
    await page.getByRole("button", { name: "Sessie aanmaken" }).click();
    await page.getByLabel("Datum en tijd").fill("2027-03-01T10:00");
    await page.getByRole("button", { name: "Aanmaken" }).click();
    await page.getByText("Consensussessie 1").click();
    await page.waitForURL(/\/sessies\//);
    await page.getByLabel("Getypte notulen").fill("Het team is het eens: plan van aanpak Noordwind 8, Van der Berg 6, Zuid-Holland 9, E2E 7. VGM: Noordwind 8, Van der Berg 5, Zuid-Holland 9, E2E 7.");
    await page.getByRole("button", { name: "Notulen opslaan" }).click();
    if (aiEnabled) {
      await page.getByRole("button", { name: "Sessie verwerken (AI)" }).click();
      await waitForJob(page, 600_000);
    }
    // Enter consensus for the first bid on the first criterion and request approval
    const consensusInput = page.locator('input[type="number"]').first();
    await consensusInput.fill("8");
    await page.locator("textarea").nth(1).fill("Consensus: goed plan van aanpak met concrete fasering en ploegbezetting.");
    await page.getByRole("button", { name: "Opslaan als concept" }).first().click();
    await expect(page.getByText(/Consensusscore opgeslagen/)).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: /Ter accordering \(/ }).first().click();
    await page.reload();
    await approveFirst(page);
    await expect(page.getByText(/Geaccordeerd: 8/).first()).toBeVisible();

    // Award page shows readiness; with AI and complete consensus the advice can be generated
    await page.goto(`${tenderUrl}/gunning`);
    await expect(page.getByText(/Geaccordeerde consensusscores:/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Gunningsadvies opstellen/ })).toBeVisible();
  });
});
