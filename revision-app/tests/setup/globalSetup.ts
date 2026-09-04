import { execSync } from "child_process";
import { rmSync } from "fs";
import path from "path";

/**
 * Creates a throwaway SQLite database for the integration tests, migrated to the current schema.
 * Runs once per `vitest` invocation, before any test file — never touches prisma/dev.db.
 */
export default function globalSetup() {
  const testDbPath = path.join(process.cwd(), "prisma", "test.db");
  rmSync(testDbPath, { force: true });
  rmSync(`${testDbPath}-journal`, { force: true });

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./prisma/test.db" },
  });
}
