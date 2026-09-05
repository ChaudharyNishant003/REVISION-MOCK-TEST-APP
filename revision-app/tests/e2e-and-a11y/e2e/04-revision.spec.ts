import { test, expect } from "@playwright/test";

import { E2E_EXAM_NAME } from "../../fixtures/e2eSeed";

test.describe("Dashboard and revision tracking", () => {
  test("dashboard shows the real exam name and a 60-day countdown", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(E2E_EXAM_NAME)).toBeVisible();
    await expect(page.locator(".countdown-number")).toHaveText("60");
  });

  test("sidebar navigation reaches every main section", async ({ page }) => {
    // Mock Tests (and the test runner/result pages) deliberately use a sidebar-free
    // "test-page" layout — Document 10 §16's "distraction-free" runner requirement — so
    // the loop returns to the dashboard before each click rather than chaining through it.
    for (const [label, urlPattern] of [
      ["Revision", /\/revision/],
      ["Mock Tests", /\/mock-tests/],
      ["Question Bank", /\/question-bank/],
      ["Analytics", /\/analytics/],
    ] as const) {
      await page.goto("/");
      // Scoped to the sidebar nav specifically — "Analytics" also appears as a shortcut
      // link inside the dashboard's "Weak areas" panel, so an unscoped match is ambiguous.
      // Each nav link's accessible name is an icon glyph followed by the label, so match
      // by substring rather than an exact string.
      await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(urlPattern);
    }
  });

  test("the revision page lists today's plan with the seeded syllabus topics", async ({ page }) => {
    await page.goto("/revision");

    // Scoped to the subject heading — "Financial Accounting" also appears as a substring
    // inside each topic row's "Subject · Chapter" meta line further down the same page.
    await expect(page.getByRole("heading", { name: "Financial Accounting" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Taxation" })).toBeVisible();
  });

  test("completing a task with a confidence rating removes it from today's list", async ({ page }) => {
    await page.goto("/revision");

    const firstTask = page.locator(".task-row").first();
    const topicName = await firstTask.locator(".task-info strong").innerText();

    await firstTask.getByRole("button", { name: /complete/i }).click();
    await firstTask.getByRole("button", { name: /^strong$/i }).click();

    // The task is completed and should no longer sit in today's due/overdue list.
    await expect(page.locator(".task-row", { hasText: topicName })).toHaveCount(0);
  });

  test("a completed revision is reflected on the Analytics page's progress count", async ({ page }) => {
    await page.goto("/revision");
    const remainingTasks = await page.locator(".task-row").count();
    if (remainingTasks > 0) {
      await page.locator(".task-row").first().getByRole("button", { name: /complete/i }).click();
      await page.getByRole("button", { name: /^okay$/i }).click();
    }

    await page.goto("/analytics");
    const revisedStat = page.locator(".mini-stats strong").first();
    await expect(revisedStat).toBeVisible();
    // "X / Y topics revised" — the numerator must be at least 1 after completing a task.
    const text = await revisedStat.innerText();
    const revisedCount = Number(text.split("/")[0].trim());
    expect(revisedCount).toBeGreaterThanOrEqual(1);
  });
});
