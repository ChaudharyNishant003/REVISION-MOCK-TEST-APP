import { execSync } from "child_process";

import { prisma } from "@/lib/prisma";

/**
 * Lazy test-database setup. Only integration tests import this, so unit and component
 * runs never pay the migration cost.
 *
 * Vitest gives each test *file* its own isolated module registry by default (verified:
 * disabling that isolation to share a migration cache across files also shared jsdom
 * state across component test files and broke cleanup between them — not worth it).
 * So an in-memory "already migrated" flag can't be shared across files. Instead this
 * relies on `prisma migrate deploy` itself being a fast no-op once every migration is
 * already applied — only the first file pays the real cost of building the schema from
 * scratch; every file after that just gets a near-instant "nothing to do" check.
 *
 * Safety: DATABASE_URL is pinned to prisma/test.db in tests/setup/env.ts, so nothing here
 * can reach prisma/dev.db, which holds real user data. The database is never deleted here —
 * `resetDatabase()` (called in each file's beforeEach) clears row data between tests instead,
 * so re-running the suite reuses the same schema rather than rebuilding it every time.
 */
function assertTestDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("test.db")) {
    throw new Error(`Refusing to run integration tests against "${url}" — expected the test database.`);
  }
}

export async function setupTestDatabase(): Promise<void> {
  assertTestDatabase();
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: "file:./prisma/test.db" },
  });
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
