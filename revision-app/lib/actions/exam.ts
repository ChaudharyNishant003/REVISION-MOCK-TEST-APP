"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { examSetupSchema } from "@/lib/validation";
import { getCurrentUserExam } from "@/lib/data/exam";

export type FormState = { error: string } | null;

export async function createExamAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();

  const parsed = examSetupSchema.safeParse({
    name: formData.get("name"),
    examDate: formData.get("examDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  const existing = await getCurrentUserExam(userId);
  if (existing) {
    redirect("/onboarding/availability");
  }

  await prisma.exam.create({
    data: { userId, name: parsed.data.name, examDate: parsed.data.examDate },
  });

  redirect("/onboarding/availability");
}

export async function updateExamAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const exam = await getCurrentUserExam(userId);
  if (!exam) return { error: "No exam found" };

  const parsed = examSetupSchema.safeParse({
    name: formData.get("name"),
    examDate: formData.get("examDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  await prisma.exam.update({
    where: { id: exam.id },
    data: { name: parsed.data.name, examDate: parsed.data.examDate },
  });

  revalidatePath("/");
  revalidatePath("/settings");
  return null;
}
