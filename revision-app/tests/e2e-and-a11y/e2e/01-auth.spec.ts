import { test, expect } from "@playwright/test";

import { E2E_USER } from "../../fixtures/e2eSeed";

// Overrides the project's saved session — these tests specifically exercise being logged out.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Authentication", () => {
  test("redirects an unauthenticated visitor away from every protected page", async ({ page }) => {
    for (const path of ["/", "/revision", "/question-bank", "/mock-tests", "/analytics", "/settings"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("rejects a wrong password with a clear error and no session", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(E2E_USER.email);
    await page.getByLabel(/password/i).fill("definitely-the-wrong-password");
    await page.getByRole("button", { name: /log in/i }).click();

    await expect(page.getByText(/incorrect email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("logs in successfully and lands somewhere other than the login page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(E2E_USER.email);
    await page.getByLabel(/password/i).fill(E2E_USER.password);
    await page.getByRole("button", { name: /log in/i }).click();

    await expect(page).not.toHaveURL(/\/login/);
  });

  test("a brand new signup reaches onboarding, not the dashboard directly", async ({ page }) => {
    const email = `e2e-fresh-${Date.now()}@test.local`;
    await page.goto("/signup");
    await page.getByLabel(/name/i).fill("Fresh Candidate");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill("FreshPass123!");
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/onboarding\/exam/);
  });

  test("rejects a signup with a duplicate email", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel(/name/i).fill("Duplicate Attempt");
    await page.getByLabel(/email/i).fill(E2E_USER.email); // already seeded
    await page.getByLabel(/password/i).fill("SomePassword123!");
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByText(/already exists/i)).toBeVisible();
  });

  test("logs out and can no longer reach a protected page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(E2E_USER.email);
    await page.getByLabel(/password/i).fill(E2E_USER.password);
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page).not.toHaveURL(/\/login/);

    // Logout is a Server Action form submit — the URL changes via a client-side transition
    // that can land on /login before the browser has actually committed the Set-Cookie
    // that clears the session (confirmed server-side behavior is correct via curl: a clean
    // Max-Age=0 + a subsequent GET / gets a real 307 to /login — this is purely a client-side
    // timing gap). Poll the actual cookie jar instead of a generic settle proxy.
    await page.getByRole("button", { name: /log out/i }).click();
    await page.waitForURL(/\/login/);
    await expect
      .poll(async () => {
        const cookies = await page.context().cookies();
        return cookies.some((c) => c.name.includes("session-token"));
      }, { message: "session cookie should be cleared after logout", timeout: 10_000 })
      .toBe(false);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });
});
