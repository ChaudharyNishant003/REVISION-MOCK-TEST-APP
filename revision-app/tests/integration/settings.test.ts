import { describe, it, expect, beforeAll, beforeEach } from "vitest";

import { prisma } from "@/lib/prisma";
import { setupTestDatabase, resetDatabase } from "../setup/testDb";
import { createUser } from "../fixtures/factories";
import { encrypt } from "@/lib/crypto";
import { getDecryptedOpenAiKey, getMaskedOpenAiKey } from "@/lib/data/user";

/**
 * The stored OpenAI key is a billable credential. These verify it round-trips for
 * server-side use, is never rendered in full, and is never sitting in the database
 * in plaintext where a database file leak would expose it.
 */
describe("Settings — stored OpenAI key", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  const REAL_KEY = "sk-proj-abcdefghijklmnop1234";

  it("stores the key encrypted — the plaintext never touches the database", async () => {
    const user = await createUser();

    await prisma.user.update({ where: { id: user.id }, data: { openaiApiKey: encrypt(REAL_KEY) } });

    const raw = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { openaiApiKey: true } });
    expect(raw.openaiApiKey).not.toBeNull();
    expect(raw.openaiApiKey).not.toContain(REAL_KEY);
    expect(raw.openaiApiKey).not.toContain("abcdefghijklmnop");
  });

  it("recovers the exact key for server-side use", async () => {
    const user = await createUser();
    await prisma.user.update({ where: { id: user.id }, data: { openaiApiKey: encrypt(REAL_KEY) } });

    expect(await getDecryptedOpenAiKey(user.id)).toBe(REAL_KEY);
  });

  it("masks the key for display, revealing only the last four characters", async () => {
    const user = await createUser();
    await prisma.user.update({ where: { id: user.id }, data: { openaiApiKey: encrypt(REAL_KEY) } });

    const masked = await getMaskedOpenAiKey(user.id);

    expect(masked).toBe("sk-••••••••1234");
    expect(masked).not.toContain("abcdefghijklmnop");
  });

  it("reports no key when none has been saved", async () => {
    const user = await createUser();

    expect(await getMaskedOpenAiKey(user.id)).toBeNull();
    expect(await getDecryptedOpenAiKey(user.id)).toBeNull();
  });

  it("clears the key completely", async () => {
    const user = await createUser();
    await prisma.user.update({ where: { id: user.id }, data: { openaiApiKey: encrypt(REAL_KEY) } });

    await prisma.user.update({ where: { id: user.id }, data: { openaiApiKey: null } });

    const raw = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { openaiApiKey: true } });
    expect(raw.openaiApiKey).toBeNull();
    expect(await getMaskedOpenAiKey(user.id)).toBeNull();
  });

  it("degrades gracefully when a stored value can no longer be decrypted", async () => {
    const user = await createUser();
    // Simulates AUTH_SECRET having been rotated, or a corrupted row.
    await prisma.user.update({ where: { id: user.id }, data: { openaiApiKey: "not-decryptable-garbage" } });

    // Server-side use must fall back to "no key" rather than throwing mid-request…
    expect(await getDecryptedOpenAiKey(user.id)).toBeNull();
    // …and the UI must say something actionable rather than crashing.
    expect(await getMaskedOpenAiKey(user.id)).toContain("re-save");
  });

  it("keeps each user's key private to them", async () => {
    const alice = await createUser({ email: `alice-${Date.now()}@test.local` });
    const bob = await createUser({ email: `bob-${Date.now()}@test.local` });

    await prisma.user.update({ where: { id: alice.id }, data: { openaiApiKey: encrypt("sk-alice-key-1111") } });
    await prisma.user.update({ where: { id: bob.id }, data: { openaiApiKey: encrypt("sk-bob-key-2222") } });

    expect(await getDecryptedOpenAiKey(alice.id)).toBe("sk-alice-key-1111");
    expect(await getDecryptedOpenAiKey(bob.id)).toBe("sk-bob-key-2222");
    expect(await getMaskedOpenAiKey(alice.id)).toBe("sk-••••••••1111");
  });

  it("returns null for a user that does not exist", async () => {
    expect(await getDecryptedOpenAiKey("no-such-user")).toBeNull();
    expect(await getMaskedOpenAiKey("no-such-user")).toBeNull();
  });
});
