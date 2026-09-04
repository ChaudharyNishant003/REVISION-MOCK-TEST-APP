/**
 * Test environment bootstrap. Runs before every test file.
 *
 * Critical: integration tests must never touch prisma/dev.db, which holds real user data.
 * DATABASE_URL is pinned to a dedicated test database here, before any module imports
 * lib/prisma.ts and reads it.
 */
process.env.DATABASE_URL = "file:./prisma/test.db";
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-not-used-in-production-abcdefghijklmnop";
