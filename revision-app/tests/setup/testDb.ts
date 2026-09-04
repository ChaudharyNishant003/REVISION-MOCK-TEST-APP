import { execSync } from "child_process";
import { rmSync } from "fs";
import path from "path";

import { prisma } from "@/lib/prisma";

/**
 * Lazy test-database setup. Only integration tests import this, so unit and component
 * runs never pay the migration cost. The migration runs at most once per vitest process.
 *
 * Safety: DATABASE_URL is pinned to prisma/test.db in tests/setup/env.ts, so nothing here
 * can reach prisma/dev.db, which holds real user data.
 */
let migrated: Promise<void> | null = null;

function assertTestDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("test.db")) {
    throw new Error(`Refusing to run integration tests against "${url}" — expected the test database.`);
  }
}

export function setupTestDatabase(): Promise<void> {
  assertTestDatabase();
  if (!migrated) {
    migrated = (async () => {
      const testDbPath = path.join(process.cwd(), "prisma", "test.db");
      rmSync(testDbPath, { force: true });
      rmSync(`${testDbPath}-journal`, { force: true });

      execSync("npx prisma migrate deploy", {
        stdio: "pipe",
        env: { ...process.env, DATABASE_URL: "file:./prisma/test.db" },
      });
    })();
  }
  return migrated;
}

/**
 * Wipes every table between tests. Ordered child-to-parent so foreign keys never block a delete.
 */
export async function resetDatabase(): Promise<void> {
  assertTestDatabase();
  await prisma.attemptAnswer.deleteMany();
  await prisma.attemptQuestion.deleteMany();
  await prisma.testAttempt.deleteMany();
  await prisma.mockTestQuestion.deleteMany();
  await prisma.mockTest.deleteMany();
  await prisma.questionExtractionMetadata.deleteMany();
  await prisma.questionOption.deleteMany();
  await prisma.question.deleteMany();
  await prisma.questionSourceImage.deleteMany();
  await prisma.aiProcessingJob.deleteMany();
  await prisma.questionSet.deleteMany();
  await prisma.topicPerformanceProfile.deleteMany();
  await prisma.revisionHistory.deleteMany();
  await prisma.revisionTask.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.chapter.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.studyAvailability.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.user.deleteMany();
}
