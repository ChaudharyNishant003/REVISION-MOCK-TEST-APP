import { test, expect } from "@playwright/test";

/**
 * The full mock-test journey end to end: start → answer every question (including a
 * deliberate wrong answer, a skip, and a mark-for-review) → submit → verify the score
 * matches what was actually answered. This is the one path through the product that
 * only a real browser driving real Server Actions can prove.
 *
 * Answer plan for "E2E Mock Test" (marksPerCorrect: 2, negativeMarksPerIncorrect: 0.5):
 *   Q1 correct (A), Q2 correct (B), Q3 WRONG (A instead of B), Q4 skipped, Q5 correct (C)
 *   → 3 correct, 1 incorrect, 1 skipped → score = 3*2 - 1*0.5 = 5.5, accuracy = 3/4 = 75%
 */
test.describe("Mock test — full attempt", () => {
  test("completes a real timed attempt and scores it correctly", async ({ page }) => {
    await page.goto("/mock-tests");
    await page.locator(".task-row", { hasText: "E2E Mock Test" }).getByRole("button", { name: /start test/i }).click();

    await expect(page).toHaveURL(/\/mock-tests\/[^/]+$/);
    await expect(page.locator(".timer")).toBeVisible();

    // Q1: answer A (correct). Scoped to the question heading specifically — Next.js also
    // renders the same text into a hidden route-announcer element for screen readers, which
    // a bare getByText would ambiguously match too.
    await expect(page.locator(".question-card h1")).toContainText("Which account shows gross profit");
    await page.locator(".option").first().click();
    await page.getByRole("button", { name: /save & next/i }).click();

    // Q2: answer B (correct)
    await expect(page.locator(".question-card h1")).toContainText("straight-line method");
    await page.locator(".option").nth(1).click();
    await page.getByRole("button", { name: /save & next/i }).click();

    // Q3: deliberately answer A instead of the correct B, and mark it for review
    await expect(page.locator(".question-card h1")).toContainText("WDV");
    await page.locator(".option").first().click();
    await page.getByRole("button", { name: /mark for review/i }).click();
    await expect(page.getByRole("button", { name: /marked for review/i })).toBeVisible();
    await page.getByRole("button", { name: /save & next/i }).click();

    // Q4: skip entirely — select nothing, just advance
    await expect(page.locator(".question-card h1")).toContainText("Input Tax Credit");
    await page.getByRole("button", { name: /save & next/i }).click();

    // Q5: answer C (correct) — last question, so the button reads "Submit test"
    await expect(page.locator(".question-card h1")).toContainText("trial balance");
    await page.locator(".option").nth(2).click();

    // The nav button for the *current* question shows "current", not "answered" — so at
    // this point only Q1/Q2 read as plain "answered" (Q3 reads "marked", which takes
    // priority over "answered" in the component regardless of its own answered state).
    await expect(page.locator(".question-number.answered")).toHaveCount(2);
    await expect(page.locator(".question-number.marked")).toHaveCount(1);

    await page.getByRole("button", { name: /submit test/i }).click();

    await expect(page.getByText(/ready to submit/i)).toBeVisible();
    const stats = page.locator(".submit-confirm-stats");
    await expect(stats).toContainText("4");
    await expect(stats).toContainText("Answered");
    await expect(stats).toContainText("Marked for review");
    await page.getByRole("button", { name: /submit test/i }).click();

    await expect(page).toHaveURL(/\/result$/);
    await expect(page.getByText("5.5")).toBeVisible(); // the exact expected score
    await expect(page.getByText(/75%/)).toBeVisible(); // 3 of 4 attempted
  });

  test("the result screen's filter tabs show the right subset", async ({ page }) => {
    await page.goto("/mock-tests");
    await page.getByRole("link", { name: /review/i }).first().click();

    await expect(page).toHaveURL(/\/result$/);

    await page.getByRole("button", { name: /^incorrect/i }).click();
    await expect(page.locator(".review-row")).toHaveCount(1);
    await expect(page.locator(".review-row")).toContainText("WDV");

    await page.getByRole("button", { name: /^skipped/i }).click();
    await expect(page.locator(".review-row")).toHaveCount(1);
    await expect(page.locator(".review-row")).toContainText("Input Tax Credit");

    await page.getByRole("button", { name: /^correct/i }).click();
    await expect(page.locator(".review-row")).toHaveCount(3);
  });

  test("attempting to reopen a submitted attempt redirects straight to its result", async ({ page }) => {
    await page.goto("/mock-tests");
    await page.getByRole("link", { name: /review/i }).first().click();
    // .click() only awaits the click action, not any navigation it triggers — read the
    // URL only after it actually lands on the result page.
    await page.waitForURL(/\/result$/);
    const resultUrl = page.url();
    const attemptId = resultUrl.match(/mock-tests\/([^/]+)\/result/)?.[1];
    expect(attemptId).toBeTruthy();

    await page.goto(`/mock-tests/${attemptId}`);
    await expect(page).toHaveURL(/\/result$/);
  });

  test("the submitted attempt now appears in test history with its real score", async ({ page }) => {
    await page.goto("/mock-tests");

    await expect(page.getByText(/test history/i)).toBeVisible();
    const historyRow = page.locator(".task-row", { hasText: "E2E Mock Test" }).last();
    await expect(historyRow).toContainText("5.5");
  });
});
