import { prisma } from "@/lib/prisma";
import { endOfDay, startOfDay } from "@/lib/scheduler/dates";

/** Flips any task whose scheduled date has passed without completion to "overdue" (Document 02 §13). */
export async function syncOverdueTasks(examId: string): Promise<void> {
  await prisma.revisionTask.updateMany({
    where: {
      examId,
      status: "scheduled",
      scheduledDate: { lt: startOfDay(new Date()) },
    },
    data: { status: "overdue" },
  });
}

/** Today's actionable list: overdue first, then due today — ordered by priority (Document 02 §10). */
export async function getTodaysTasks(examId: string) {
  await syncOverdueTasks(examId);

  return prisma.revisionTask.findMany({
    where: {
      examId,
      status: { in: ["scheduled", "overdue"] },
      scheduledDate: { lte: endOfDay(new Date()) },
    },
    include: { topic: { include: { chapter: { include: { subject: true } } } } },
    orderBy: [{ status: "asc" }, { priorityScore: "desc" }],
  });
}

export async function getRevisionProgressSummary(examId: string) {
  await syncOverdueTasks(examId);

  const [totalTopics, revisedTopicIds, dueToday, overdue, todayCompleted, todayTotal] = await Promise.all([
    prisma.topic.count({ where: { chapter: { subject: { examId } } } }),
    prisma.revisionHistory.findMany({
      where: { topic: { chapter: { subject: { examId } } } },
      select: { topicId: true },
      distinct: ["topicId"],
    }),
    prisma.revisionTask.count({ where: { examId, status: "scheduled", scheduledDate: { lte: endOfDay(new Date()) } } }),
    prisma.revisionTask.count({ where: { examId, status: "overdue" } }),
    prisma.revisionTask.count({
      where: { examId, status: "completed", completedAt: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) } },
    }),
    prisma.revisionTask.count({
      where: {
        examId,
        scheduledDate: { lte: endOfDay(new Date()) },
        OR: [
          { status: { in: ["scheduled", "overdue"] } },
          { status: "completed", completedAt: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) } },
        ],
      },
    }),
  ]);

  return {
    totalTopics,
    revisedTopics: revisedTopicIds.length,
    dueToday,
    overdue,
    todayCompleted,
    todayTotal,
  };
}
