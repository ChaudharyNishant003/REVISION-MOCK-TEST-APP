import { prisma } from "@/lib/prisma";
import { addDays, daysUntilExam, startOfDay } from "@/lib/scheduler/dates";
import { usableMinutesForDate } from "@/lib/scheduler/capacity";
import { calculatePriorityScore } from "@/lib/scheduler/priority";

/**
 * Builds the first Revision-1 task for every topic in the exam's syllabus, spread across the
 * days remaining before the exam according to configured study availability (Document 02 §9-10).
 * Deterministic — no AI involved. Safe to call once per exam; it no-ops if tasks already exist
 * so it never overwrites progress. Use scheduleTopicIntoPlan for topics added later.
 */
export async function generateInitialPlan(examId: string): Promise<{ scheduled: number; unscheduled: number }> {
  const existingCount = await prisma.revisionTask.count({ where: { examId } });
  if (existingCount > 0) {
    return { scheduled: 0, unscheduled: 0 };
  }

  const exam = await prisma.exam.findUniqueOrThrow({
    where: { id: examId },
    include: {
      availability: true,
      subjects: { include: { chapters: { include: { topics: true } } } },
    },
  });

  const topics = exam.subjects.flatMap((s) => s.chapters.flatMap((c) => c.topics));
  if (topics.length === 0) {
    return { scheduled: 0, unscheduled: 0 };
  }

  const today = startOfDay(new Date());
  const totalWindowDays = Math.max(1, daysUntilExam(exam.examDate, today));

  const prioritized = topics
    .map((topic) => ({
      topic,
      priority: calculatePriorityScore({
        importance: topic.importance as "low" | "medium" | "high",
        difficulty: topic.difficulty as "easy" | "medium" | "hard",
        daysUntilExam: totalWindowDays,
        totalPrepWindowDays: totalWindowDays,
      }),
    }))
    .sort((a, b) => b.priority - a.priority);

  // Walk forward day by day, tracking remaining usable minutes per day, and drop each topic
  // into the earliest day that still has room for it.
  const dayCursorLimit = Math.max(1, totalWindowDays - 1); // leave the final day free for consolidation
  const remainingMinutesByOffset = new Map<number, number>();

  function remainingFor(offset: number): number {
    if (!remainingMinutesByOffset.has(offset)) {
      remainingMinutesByOffset.set(offset, usableMinutesForDate(addDays(today, offset), exam.availability));
    }
    return remainingMinutesByOffset.get(offset)!;
  }

  const tasksToCreate: {
    topicId: string;
    scheduledDate: Date;
    estimatedMinutes: number;
    priorityScore: number;
  }[] = [];

  let unscheduled = 0;

  for (const { topic, priority } of prioritized) {
    let placed = false;
    for (let offset = 0; offset <= dayCursorLimit; offset++) {
      const remaining = remainingFor(offset);
      if (remaining >= topic.estimatedRevisionMinutes) {
        remainingMinutesByOffset.set(offset, remaining - topic.estimatedRevisionMinutes);
        tasksToCreate.push({
          topicId: topic.id,
          scheduledDate: addDays(today, offset),
          estimatedMinutes: topic.estimatedRevisionMinutes,
          priorityScore: priority,
        });
        placed = true;
        break;
      }
    }
    if (!placed) unscheduled++;
  }

  if (tasksToCreate.length > 0) {
    await prisma.revisionTask.createMany({
      data: tasksToCreate.map((t) => ({
        examId,
        topicId: t.topicId,
        revisionNumber: 1,
        scheduledDate: t.scheduledDate,
        estimatedMinutes: t.estimatedMinutes,
        priorityScore: t.priorityScore,
        status: "scheduled",
      })),
    });
  }

  return { scheduled: tasksToCreate.length, unscheduled };
}

/** Places a single newly-added topic into the plan without disturbing existing tasks (Document 02 §15). */
export async function scheduleTopicIntoPlan(examId: string, topicId: string): Promise<boolean> {
  const [exam, topic] = await Promise.all([
    prisma.exam.findUniqueOrThrow({ where: { id: examId }, include: { availability: true } }),
    prisma.topic.findUniqueOrThrow({ where: { id: topicId } }),
  ]);

  const today = startOfDay(new Date());
  const totalWindowDays = Math.max(1, daysUntilExam(exam.examDate, today));
  const dayCursorLimit = Math.max(1, totalWindowDays - 1);

  const existingTasks = await prisma.revisionTask.findMany({
    where: { examId, status: { in: ["scheduled", "due"] } },
  });

  for (let offset = 0; offset <= dayCursorLimit; offset++) {
    const date = addDays(today, offset);
    const usedOnDay = existingTasks
      .filter((t) => startOfDay(t.scheduledDate).getTime() === date.getTime())
      .reduce((sum, t) => sum + t.estimatedMinutes, 0);
    const usable = usableMinutesForDate(date, exam.availability);

    if (usable - usedOnDay >= topic.estimatedRevisionMinutes) {
      const priority = calculatePriorityScore({
        importance: topic.importance as "low" | "medium" | "high",
        difficulty: topic.difficulty as "easy" | "medium" | "hard",
        daysUntilExam: totalWindowDays,
        totalPrepWindowDays: totalWindowDays,
      });
      await prisma.revisionTask.create({
        data: {
          examId,
          topicId,
          revisionNumber: 1,
          scheduledDate: date,
          estimatedMinutes: topic.estimatedRevisionMinutes,
          priorityScore: priority,
          status: "scheduled",
        },
      });
      return true;
    }
  }

  return false;
}
