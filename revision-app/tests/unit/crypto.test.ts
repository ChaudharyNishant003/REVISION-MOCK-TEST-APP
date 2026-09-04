import { describe, it, expect, afterEach } from "vitest";

import { encrypt, decrypt } from "@/lib/crypto";

/**
 * The user's OpenAI API key is a billable credential stored in the database.
 * These tests prove it round-trips correctly, is never recoverable without the
 * server secret, and that tampering is detected rather than silently accepted.
 */
const ORIGINAL_SECRET = process.env.AUTH_SECRET;

afterEach(() => {
  process.env.AUTH_SECRET = ORIGINAL_SECRET;
});

describe("encrypt / decrypt", () => {
  it("round-trips a value unchanged", () => {
    const plaintext = "sk-proj-abc123XYZ-a-realistic-looking-key";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("never leaves the plaintext visible in the ciphertext", () => {
    const plaintext = "sk-secret-value-9876";
    const encrypted = encrypt(plaintext);

    expect(encrypted).not.toContain(plaintext);
    expect(encrypted).not.toContain("secret-value");
    expect(Buffer.from(encrypted, "base64").toString("utf8")).not.toContain(plaintext);
  });

  it("produces a different ciphertext each time (random IV), so equal keys aren't linkable", () => {
    const plaintext = "sk-same-input-every-time";
    const first = encrypt(plaintext);
    const second = encrypt(plaintext);

    expect(first).not.toBe(second);
    // Both must still decrypt back to the same value.
    expect(decrypt(first)).toBe(plaintext);
    expect(decrypt(second)).toBe(plaintext);
  });

  it("fails to decrypt when the server secret changed (e.g. AUTH_SECRET rotated)", () => {
    const encrypted = encrypt("sk-encrypted-under-the-old-secret");

    process.env.AUTH_SECRET = "a-completely-different-secret-value-0123456789";

    expect(() => decrypt(encrypted)).toThrow();
  });

  it("rejects tampered ciphertext instead of returning corrupted output", () => {
    const encrypted = encrypt("sk-do-not-tamper-with-me");
    const raw = Buffer.from(encrypted, "base64");
    // Flip a bit deep in the ciphertext body (past the 12-byte IV and 16-byte auth tag).
    raw[raw.length - 1] = raw[raw.length - 1] ^ 0xff;
    const tampered = raw.toString("base64");

    expect(() => decrypt(tampered)).toThrow();
  });

  it("rejects a truncated or malformed value", () => {
    expect(() => decrypt("not-valid-base64-ciphertext")).toThrow();
    expect(() => decrypt("")).toThrow();
  });

  it("throws a clear error when AUTH_SECRET is not configured at all", () => {
    delete process.env.AUTH_SECRET;

    expect(() => encrypt("sk-anything")).toThrow(/AUTH_SECRET/);
    expect(() => decrypt("anything")).toThrow(/AUTH_SECRET/);
  });

  it("handles unicode and long values", () => {
    const unicode = "sk-ключ-キー-🔑-value";
    expect(decrypt(encrypt(unicode))).toBe(unicode);

    const long = "sk-" + "x".repeat(5000);
    expect(decrypt(encrypt(long))).toBe(long);
  });
});
