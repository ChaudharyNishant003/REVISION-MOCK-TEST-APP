import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    // Integration tests share one SQLite test database, so they must not run concurrently.
    fileParallelism: false,
    // The first integration file pays for `prisma migrate deploy` (~20s) in its beforeAll.
    hookTimeout: 90_000,
    testTimeout: 20_000,
    // Component tests opt into jsdom per-file via a `@vitest-environment jsdom` docblock
    // (environmentMatchGlobs was removed in Vitest 5).
    setupFiles: ["tests/setup/env.ts"],
    // No globalSetup: the test database is migrated lazily by tests/setup/testDb.ts,
    // which only integration tests import — unit and component runs stay fast.
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
