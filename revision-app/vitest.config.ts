import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    // Integration tests share one SQLite test database, so they must not run concurrently.
    fileParallelism: false,
    // Component tests opt into jsdom per-file via a `@vitest-environment jsdom` docblock
    // (environmentMatchGlobs was removed in Vitest 5).
    setupFiles: ["tests/setup/env.ts"],
    globalSetup: ["tests/setup/globalSetup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
