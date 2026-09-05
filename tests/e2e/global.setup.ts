import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Signs in a real Clerk test user once and stores the browser state for all
 * e2e flows. Requires E2E_CLERK_USER_EMAIL / E2E_CLERK_USER_PASSWORD and the
 * Clerk keys of a development instance in .env. Without them the suite is skipped.
 */
setup("authenticate with Clerk", async ({ page }) => {
  const email = process.env.E2E_CLERK_USER_EMAIL;
  const password = process.env.E2E_CLERK_USER_PASSWORD;
  setup.skip(!email || !password, "E2E_CLERK_USER_EMAIL/PASSWORD niet ingesteld");
  await clerkSetup();
  await page.goto("/sign-in");
  await clerk.signIn({ page, signInParams: { strategy: "password", identifier: email!, password: password! } });
  await page.goto("/projecten");
  await page.waitForURL(/\/(projecten|organisatie)/);
  mkdirSync("tests/e2e/.auth", { recursive: true });
  await page.context().storageState({ path: "tests/e2e/.auth/user.json" });
});
