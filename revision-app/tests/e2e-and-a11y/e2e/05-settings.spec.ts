import { test, expect } from "@playwright/test";

/**
 * Runs last among the e2e specs (numeric file prefix enforces this) — it mutates the
 * exam name/date and the availability list, which earlier specs (the dashboard countdown,
 * the revision plan) assert against in their original seeded state.
 */
test.describe("Settings", () => {
  test("edits the exam name and it's reflected on the dashboard", async ({ page }) => {
    await page.goto("/settings");

    const nameInput = page.getByLabel(/exam name/i);
    await nameInput.fill("Updated Exam Name");
    await page.getByRole("button", { name: /save changes/i }).click();

    await expect(page.getByLabel(/exam name/i)).toHaveValue("Updated Exam Name");

    await page.goto("/");
    await expect(page.getByText("Updated Exam Name")).toBeVisible();
  });

  test("adds and removes a study availability slot", async ({ page }) => {
    await page.goto("/settings");

    await page.getByLabel(/day/i).selectOption("3"); // Wednesday
    await page.getByLabel(/start/i).fill("06:00");
    await page.getByLabel(/end/i).fill("08:00");
    await page.getByRole("button", { name: /add slot/i }).click();

    const newSlot = page.locator(".slot-row", { hasText: "06:00" });
    await expect(newSlot).toBeVisible();

    await newSlot.getByRole("button", { name: /remove/i }).click();
    await expect(page.locator(".slot-row", { hasText: "06:00" })).toHaveCount(0);
  });

  test("saves an OpenAI key, shows it masked, then clears it", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.getByText(/no key configured/i)).toBeVisible();

    await page.getByLabel(/new api key/i).fill("sk-test-fixture-not-a-real-key-9999");
    await page.getByRole("button", { name: /save key/i }).click();

    await expect(page.getByText(/sk-••••••••9999/)).toBeVisible();
    // The real key must never appear anywhere on the page after saving.
    await expect(page.getByText(/sk-test-fixture-not-a-real-key/)).toHaveCount(0);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /clear key/i }).click();

    await expect(page.getByText(/no key configured/i)).toBeVisible();
  });

  test("submitting the key form with a blank field leaves the saved key untouched", async ({ page }) => {
    await page.goto("/settings");

    await page.getByLabel(/new api key/i).fill("sk-should-be-kept-1234");
    await page.getByRole("button", { name: /save key/i }).click();
    await expect(page.getByText(/sk-••••••••1234/)).toBeVisible();

    // Submitting again with an empty field must not clear it — only the Clear button may.
    await page.getByRole("button", { name: /save key/i }).click();
    await expect(page.getByText(/sk-••••••••1234/)).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /clear key/i }).click();
  });

  test("rejects a key that doesn't look like an OpenAI key", async ({ page }) => {
    await page.goto("/settings");

    await page.getByLabel(/new api key/i).fill("not-a-real-openai-key");
    await page.getByRole("button", { name: /save key/i }).click();

    await expect(page.getByText(/start with/i)).toBeVisible();
    await expect(page.getByText(/no key configured/i)).toBeVisible();
  });
});
