import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

/**
 * Decrypted key for server-side use only (the AI extraction call site). Never render this.
 * Returns null on no stored key or a decrypt failure (e.g. AUTH_SECRET rotated) — the caller
 * falls back to the OPENAI_API_KEY env var.
 */
export async function getDecryptedOpenAiKey(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { openaiApiKey: true } });
  if (!user?.openaiApiKey) return null;
  try {
    return decrypt(user.openaiApiKey);
  } catch {
    return null;
  }
}

/** Masked preview for the Settings UI, e.g. "sk-••••••••ab12". Never returns the real key. */
export async function getMaskedOpenAiKey(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { openaiApiKey: true } });
  if (!user?.openaiApiKey) return null;
  try {
    return `sk-••••••••${decrypt(user.openaiApiKey).slice(-4)}`;
  } catch {
    return "sk-•••••••• (unreadable — re-save your key)";
  }
}
