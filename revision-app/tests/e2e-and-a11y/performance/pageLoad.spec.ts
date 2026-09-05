import { test, expect } from "@playwright/test";

/**
 * A coarse budget, not a micro-benchmark: this is one local dev machine, not representative
 * hosting. The point is catching a regression that makes a page dramatically slower
 * (an N+1 query, a missing index, an accidental synchronous block), not chasing milliseconds.
 */
const BUDGET_MS = 4000;

const PAGES = [
  ["/", "Dashboard"],
  ["/revision", "Revision"],
  ["/question-bank", "Question Bank"],
  ["/mock-tests", "Mock Tests"],
  ["/analytics", "Analytics"],
  ["/settings", "Settings"],
] as const;

for (const [path, label] of PAGES) {
  test(`${label} loads within the ${BUDGET_MS}ms budget`, async ({ page }) => {
    const start = Date.now();
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    const elapsed = Date.now() - start;

    expect(response?.status()).toBeLessThan(400);
    expect(elapsed, `${label} took ${elapsed}ms (budget ${BUDGET_MS}ms)`).toBeLessThan(BUDGET_MS);
  });
}

test("navigating between pages via the sidebar stays responsive", async ({ page }) => {
  await page.goto("/");

  const start = Date.now();
  // Scoped to the sidebar nav — "Analytics" also appears as a shortcut link inside the
  // dashboard's "Weak areas" panel, so an unscoped match is ambiguous (see 04-revision.spec.ts).
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Analytics" }).click();
  await page.waitForURL(/\/analytics/);
  const elapsed = Date.now() - start;

  expect(elapsed, `client navigation took ${elapsed}ms`).toBeLessThan(BUDGET_MS);
});
