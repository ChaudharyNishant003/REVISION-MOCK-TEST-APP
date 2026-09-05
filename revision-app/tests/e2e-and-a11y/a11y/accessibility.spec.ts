import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Runs on the pages a candidate spends the most time on. Scoped to WCAG 2.1 A/AA —
 * the practical bar most real accessibility audits are judged against — and read-only,
 * so it's safe to run in any order relative to the mutating e2e specs.
 */
const PAGES = [
  ["/", "Dashboard"],
  ["/revision", "Revision"],
  ["/question-bank", "Question Bank"],
  ["/mock-tests", "Mock Tests"],
  ["/analytics", "Analytics"],
  ["/settings", "Settings"],
] as const;

for (const [path, label] of PAGES) {
  test(`${label} page has no automatically detectable WCAG 2.1 A/AA violations`, async ({ page }) => {
    await page.goto(path);

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();

    if (results.violations.length > 0) {
      const summary = results.violations
        .map((v) => `- [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} element(s))`)
        .join("\n");
      console.log(`Accessibility violations on ${label}:\n${summary}`);
    }

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}

test("the login page (unauthenticated) is also clean", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/login");

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});
