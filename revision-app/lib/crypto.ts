import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * Encrypts small secrets (e.g. a user's OpenAI API key) at rest, deriving the key from the
 * server's existing AUTH_SECRET rather than requiring a second secret to manage.
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;
const SALT = "revision-app.secrets.v1";

function deriveKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured; cannot encrypt/decrypt stored secrets");
  return scryptSync(secret, SALT, KEY_LENGTH);
}

/** Encrypts plaintext to one base64 string: iv(12) + authTag(16) + ciphertext. */
export function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

/** Reverses encrypt(). Throws if the value is malformed or AUTH_SECRET doesn't match what encrypted it. */
export function decrypt(encoded: string): string {
  const key = deriveKey();
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);
  // authTagLength is passed explicitly: without it Node emits a deprecation warning and
  // would accept a short (weakened) tag from a malformed value instead of rejecting it.
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
