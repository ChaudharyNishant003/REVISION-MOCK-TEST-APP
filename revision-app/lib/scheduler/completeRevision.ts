import { prisma } from "@/lib/prisma";
import { addDays, daysUntilExam, startOfDay } from "@/lib/scheduler/dates";
import { nextRevisionGapDays, calculatePriorityScore } from "@/lib/scheduler/priority";

type Confidence = "strong" | "okay" | "weak";

/**
 * Marks a revision task complete, records history, and schedules the next revision for that
 * topic further out (Document 02 §12). Does not touch any other task — future planning adapts
 * gradually rather than rebuilding the whole schedule (Document 02 §14, §20).
 */
export async function completeRevisionTask(taskId: string, confidence?: Confidence) {
  const task = await prisma.revisionTask.findUniqueOrThrow({
    where: { id: taskId },
    include: { topic: true, exam: true },
  });

  const now = new Date();

  await prisma.$transaction([
    prisma.revisionTask.update({
      where: { id: taskId },
      data: { status: "completed", completedAt: now },
    }),
    prisma.revisionHistory.create({
      data: {
        topicId: task.topicId,
        revisionTaskId: task.id,
        revisionNumber: task.revisionNumber,
        confidence: confidence ?? null,
        estimatedMinutes: task.estimatedMinutes,
        completedAt: now,
      },
    }),
  ]);

  const remainingDays = daysUntilExam(task.exam.examDate, now);
  if (remainingDays <= 1) {
    // Too close to the exam to schedule another cycle for this topic.
    return;
  }

  const gapDays = nextRevisionGapDays(task.revisionNumber, confidence, remainingDays);
  const nextDate = startOfDay(addDays(now, gapDays));

  const priority = calculatePriorityScore({
    importance: task.topic.importance as "low" | "medium" | "high",
    difficulty: task.topic.difficulty as "easy" | "medium" | "hard",
    lastConfidence: confidence,
    daysUntilExam: remainingDays,
    totalPrepWindowDays: remainingDays,
  });

  await prisma.revisionTask.create({
    data: {
      examId: task.examId,
      topicId: task.topicId,
      revisionNumber: task.revisionNumber + 1,
      scheduledDate: nextDate,
      estimatedMinutes: task.estimatedMinutes,
      priorityScore: priority,
      status: "scheduled",
    },
  });
}
