"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { completeRevisionSchema } from "@/lib/validation";
import { completeRevisionTask } from "@/lib/scheduler/completeRevision";

export type FormState = { error: string } | null;

export async function completeRevisionTaskAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();

  const parsed = completeRevisionSchema.safeParse({
    taskId: formData.get("taskId"),
    confidence: formData.get("confidence") || undefined,
  });
  if (!parsed.success) return { error: "Invalid request" };

  const task = await prisma.revisionTask.findUnique({
    where: { id: parsed.data.taskId },
    include: { exam: true },
  });
  if (!task || task.exam.userId !== userId) {
    return { error: "Task not found" };
  }
  if (task.status === "completed") {
    return null;
  }

  await completeRevisionTask(parsed.data.taskId, parsed.data.confidence);

  revalidatePath("/");
  revalidatePath("/revision");
  return null;
}
