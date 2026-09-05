import { test as setup, expect } from "@playwright/test";

import { E2E_USER } from "../fixtures/e2eSeed";

const authFile = "test-results/.auth/user.json";

/**
 * Logs in once through the real login form and saves the session, so every other spec
 * starts already authenticated instead of re-running the login flow per file.
 */
setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(E2E_USER.email);
  await page.getByLabel(/password/i).fill(E2E_USER.password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();

  await expect(page).not.toHaveURL(/\/login/);
  await page.context().storageState({ path: authFile });
});
