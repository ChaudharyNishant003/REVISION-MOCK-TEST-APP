"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { encrypt } from "@/lib/crypto";
import { openaiApiKeySchema } from "@/lib/validation";

export type FormState = { error: string } | null;

/** Blank input is a deliberate no-op — Clear is the only way to remove a stored key. */
export async function saveOpenAiKeyAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const raw = String(formData.get("apiKey") ?? "").trim();
  if (raw === "") return null;

  const parsed = openaiApiKeySchema.safeParse({ apiKey: raw });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid API key" };

  await prisma.user.update({ where: { id: userId }, data: { openaiApiKey: encrypt(parsed.data.apiKey) } });
  revalidatePath("/settings");
  return null;
}

export async function clearOpenAiKeyAction(): Promise<void> {
  const userId = await requireUserId();
  await prisma.user.update({ where: { id: userId }, data: { openaiApiKey: null } });
  revalidatePath("/settings");
}
