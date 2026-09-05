import { defineConfig, devices } from "@playwright/test";

/**
 * Drives a production build of the real app in real Chrome (not a headless-only browser
 * download — `channel: "chrome"` uses the system install). Runs against a dedicated e2e.db,
 * never prisma/dev.db. Next.js never overrides an env var already set in the process, so
 * DATABASE_URL set here wins over whatever revision-app/.env has for local dev use.
 */
const PORT = 3100;

export default defineConfig({
  testDir: "./tests/e2e-and-a11y",
  fullyParallel: false, // one shared e2e.db — specs run in sequence
  retries: 0, // a flaky pass is not a pass; failures should be fixed, not hidden
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "test-results/playwright-results.json" }], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { channel: "chrome" },
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome", storageState: "test-results/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run e2e:serve",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: "file:./prisma/e2e.db",
    },
  },
});
