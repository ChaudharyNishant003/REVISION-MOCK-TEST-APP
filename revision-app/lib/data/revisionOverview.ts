import { prisma } from "@/lib/prisma";

export async function getTopicScheduleInfo(examId: string) {
  const [history, upcomingTasks] = await Promise.all([
    prisma.revisionHistory.findMany({
      where: { topic: { chapter: { subject: { examId } } } },
      orderBy: { completedAt: "desc" },
    }),
    prisma.revisionTask.findMany({
      where: { examId, status: { in: ["scheduled", "overdue"] } },
      orderBy: { scheduledDate: "asc" },
    }),
  ]);

  const lastRevisedByTopic = new Map<string, Date>();
  const revisionCountByTopic = new Map<string, number>();
  for (const h of history) {
    if (!lastRevisedByTopic.has(h.topicId)) lastRevisedByTopic.set(h.topicId, h.completedAt);
    revisionCountByTopic.set(h.topicId, (revisionCountByTopic.get(h.topicId) ?? 0) + 1);
  }

  const nextTaskByTopic = new Map<string, (typeof upcomingTasks)[number]>();
  for (const t of upcomingTasks) {
    if (!nextTaskByTopic.has(t.topicId)) nextTaskByTopic.set(t.topicId, t);
  }

  return { lastRevisedByTopic, revisionCountByTopic, nextTaskByTopic };
}
