"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { availabilitySlotSchema } from "@/lib/validation";
import { getCurrentUserExam, getExamOwnedByUser } from "@/lib/data/exam";

export type FormState = { error: string } | null;

export async function addAvailabilitySlotAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const exam = await getCurrentUserExam(userId);
  if (!exam) return { error: "Set up your exam first" };

  const parsed = availabilitySlotSchema.safeParse({
    dayOfWeek: Number(formData.get("dayOfWeek")),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid slot" };
  }

  await prisma.studyAvailability.create({
    data: { examId: exam.id, ...parsed.data },
  });

  revalidatePath("/onboarding/availability");
  revalidatePath("/settings");
  return null;
}

export async function deleteAvailabilitySlotAction(slotId: string): Promise<void> {
  const userId = await requireUserId();
  const slot = await prisma.studyAvailability.findUnique({
    where: { id: slotId },
    include: { exam: true },
  });
  if (!slot) return;

  const exam = await getExamOwnedByUser(slot.examId, userId);
  if (!exam) return;

  await prisma.studyAvailability.delete({ where: { id: slotId } });
  revalidatePath("/onboarding/availability");
  revalidatePath("/settings");
}
