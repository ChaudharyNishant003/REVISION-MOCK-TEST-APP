import { test, expect } from "@playwright/test";

test.describe("Question Bank and review", () => {
  test("lists the seeded approved questions and filters by search text", async ({ page }) => {
    await page.goto("/question-bank");

    await expect(page.getByText("Which account shows gross profit")).toBeVisible();

    await page.getByLabel(/search/i).fill("Input Tax Credit");
    await expect(page.getByText("Which account shows gross profit")).toHaveCount(0);
    await expect(page.getByText(/Input Tax Credit cannot generally/)).toBeVisible();
  });

  test("approves a draft question through the real review form", async ({ page }) => {
    await page.goto("/question-bank");
    // The set name also appears inside every question's meta line and in the mock-test
    // question-set filter dropdown — the set-card link itself is the unambiguous target.
    await page.getByRole("link", { name: /E2E Practice Set/ }).click();

    await expect(page.getByText(/1 draft question/i)).toBeVisible();
    await expect(page.getByText("Margin of safety is the difference between")).toBeVisible();
    const approvedCountBefore = await page.locator(".panel-kicker", { hasText: "APPROVED FROM THIS SET" }).innerText();

    // The seeded draft already has a valid correct answer selected — approving it as-is
    // proves the whole approve transaction (option persistence + status flip) works.
    // Accessible name is "Approve →" (the arrow is a separate span), so match loosely.
    await page.getByRole("button", { name: /approve/i }).click();
    await expect(page.getByText(/0 draft questions/i)).toBeVisible();

    // "APPROVED FROM THIS SET" counts every approved question in the set, not just this
    // one — it should have grown by exactly one, and the newly-approved text now appears
    // in that list.
    const approvedCountAfter = await page.locator(".panel-kicker", { hasText: "APPROVED FROM THIS SET" }).innerText();
    const before = Number(approvedCountBefore.match(/\d+/)?.[0]);
    const after = Number(approvedCountAfter.match(/\d+/)?.[0]);
    expect(after).toBe(before + 1);
    await expect(
      page.locator(".task-row", { hasText: "Margin of safety is the difference between" })
    ).toBeVisible();
  });

  test("the newly approved question is now selectable when creating a mock test", async ({ page }) => {
    await page.goto("/mock-tests/new");
    await expect(page.getByText("Margin of safety is the difference between")).toBeVisible();
  });

  test("edits an already-approved question in place from the bank", async ({ page }) => {
    await page.goto("/question-bank");

    const row = page.locator(".task-row", { hasText: "Which account shows gross profit" });
    await row.getByRole("button", { name: "Edit" }).click();

    const textarea = page.getByLabel(/question text/i);
    await expect(textarea).toHaveValue(/Which account shows gross profit/);
    await textarea.fill("Which account shows gross profit or loss (edited)?");
    await page.getByRole("button", { name: /save changes/i }).click();

    await expect(page.getByText("Which account shows gross profit or loss (edited)?")).toBeVisible();
  });

  test("archiving a question removes it from the approved list", async ({ page }) => {
    await page.goto("/question-bank");

    const row = page.locator(".task-row", { hasText: "Under WDV, depreciation is charged on" });
    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Archive" }).click();

    await expect(page.getByText("Under WDV, depreciation is charged on")).toHaveCount(0);
  });
});
