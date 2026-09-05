import { expect, type Page } from "@playwright/test";

export const e2eEnabled = Boolean(process.env.E2E_CLERK_USER_EMAIL && process.env.E2E_CLERK_USER_PASSWORD);
export const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY);

/** Waits until no job progress indicator is visible (AI task finished) and the page refreshed. */
export async function waitForJob(page: Page, timeout = 240_000) {
  await expect(page.getByText(/Gereed\. Pagina wordt ververst/)).toBeVisible({ timeout }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.reload();
}

/** Approves the first open approval on the current page through the generic approve dialog. */
export async function approveFirst(page: Page) {
  await page.getByRole("button", { name: "Accorderen" }).first().click();
  await page.getByRole("button", { name: "Definitief accorderen" }).click();
  await expect(page.getByText(/Geaccordeerd en vastgelegd/)).toBeVisible();
}

export function uniqueSuffix() {
  return Date.now().toString(36).slice(-5).toUpperCase();
}
