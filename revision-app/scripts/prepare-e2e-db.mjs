import { execSync } from "child_process";
import { rmSync } from "fs";

/**
 * Rebuilds prisma/e2e.db from scratch before every E2E run, so specs always start from the
 * same known fixture rather than whatever a previous run left behind. This is a one-time
 * setup cost per E2E run (not per-file like the integration suite), so a full rebuild is fine.
 */
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || !dbUrl.includes("e2e.db")) {
  throw new Error(`Refusing to prepare "${dbUrl}" — expected the e2e database.`);
}

const dbPath = dbUrl.replace(/^file:/, "");
rmSync(dbPath, { force: true });
rmSync(`${dbPath}-journal`, { force: true });

execSync("npx prisma migrate deploy", { stdio: "inherit" });
execSync("npx tsx tests/fixtures/e2eSeed.ts", { stdio: "inherit" });
