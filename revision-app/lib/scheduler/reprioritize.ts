import { prisma } from "@/lib/prisma";
import { daysBetween, startOfDay } from "@/lib/scheduler/dates";
import { calculatePriorityScore } from "@/lib/scheduler/priority";

type Confidence = "strong" | "okay" | "weak";

/**
 * Re-scores a topic's still-open revision tasks after new mock-test performance arrives
 * (Document 02 §19, Document 04 §19). Only adjusts priorityScore on existing tasks — it never
 * moves scheduledDate or creates/removes tasks, so a single test never rebuilds the plan.
 */
export async function reprioritizeTopic(topicId: string): Promise<void> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { chapter: { include: { subject: { include: { exam: true } } } } },
  });
  if (!topic) return;

  const openTasks = await prisma.revisionTask.findMany({
    where: { topicId, status: { in: ["scheduled", "due", "overdue"] } },
  });
  if (openTasks.length === 0) return;

  const [lastHistory, profile] = await Promise.all([
    prisma.revisionHistory.findFirst({ where: { topicId }, orderBy: { completedAt: "desc" } }),
    prisma.topicPerformanceProfile.findUnique({ where: { topicId } }),
  ]);

  const today = startOfDay(new Date());
  const daysUntilExam = Math.max(0, daysBetween(today, topic.chapter.subject.exam.examDate));
  const recentMockAccuracy = profile?.recentAccuracy ?? profile?.accuracy ?? null;
  const daysSinceLastRevision = lastHistory ? daysBetween(lastHistory.completedAt, today) : null;

  await Promise.all(
    openTasks.map((task) => {
      const daysOverdue = task.scheduledDate < today ? daysBetween(task.scheduledDate, today) : 0;
      const priorityScore = calculatePriorityScore({
        importance: topic.importance as "low" | "medium" | "high",
        difficulty: topic.difficulty as "easy" | "medium" | "hard",
        lastConfidence: lastHistory?.confidence as Confidence | null | undefined,
        daysOverdue,
        daysSinceLastRevision,
        daysUntilExam,
        totalPrepWindowDays: daysUntilExam,
        recentMockAccuracy,
      });
      return prisma.revisionTask.update({ where: { id: task.id }, data: { priorityScore } });
    })
  );
}
