import { describe, it, expect, beforeAll, beforeEach } from "vitest";

import { prisma } from "@/lib/prisma";
import { setupTestDatabase, resetDatabase } from "../setup/testDb";
import { createUser, createExam, createFullAvailability, createSyllabus } from "../fixtures/factories";
import { generateInitialPlan, scheduleTopicIntoPlan } from "@/lib/scheduler/generatePlan";
import { completeRevisionTask } from "@/lib/scheduler/completeRevision";
import { syncOverdueTasks, getTodaysTasks, getRevisionProgressSummary } from "@/lib/scheduler/dailyTasks";
import { startOfDay, addDays } from "@/lib/scheduler/dates";

/**
 * The scheduler is the product's core promise: "tell me what to revise today."
 * These run the real engine against a real database.
 */
describe("Revision scheduler", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  async function setupExamWithTopics(topicSpecs = [{ name: "Topic A" }, { name: "Topic B" }, { name: "Topic C" }]) {
    const user = await createUser();
    const exam = await createExam(user.id, { daysOut: 60 });
    await createFullAvailability(exam.id);
    const syllabus = await createSyllabus(exam.id, topicSpecs);
    return { user, exam, syllabus };
  }

  describe("generateInitialPlan", () => {
    it("schedules a first revision for every topic when capacity allows", async () => {
      const { exam, syllabus } = await setupExamWithTopics();

      const result = await generateInitialPlan(exam.id);

      expect(result).toEqual({ scheduled: 3, unscheduled: 0 });

      const tasks = await prisma.revisionTask.findMany({ where: { examId: exam.id } });
      expect(tasks).toHaveLength(3);
      expect(tasks.every((t) => t.revisionNumber === 1)).toBe(true);
      expect(tasks.every((t) => t.status === "scheduled")).toBe(true);
      expect(new Set(tasks.map((t) => t.topicId))).toEqual(new Set(syllabus.topics.map((t) => t.id)));
    });

    it("copies each topic's estimated duration onto its task", async () => {
      const { exam } = await setupExamWithTopics([
        { name: "Short", estimatedRevisionMinutes: 15 },
        { name: "Long", estimatedRevisionMinutes: 90 },
      ]);

      await generateInitialPlan(exam.id);

      const tasks = await prisma.revisionTask.findMany({ where: { examId: exam.id }, include: { topic: true } });
      expect(tasks.find((t) => t.topic.name === "Short")?.estimatedMinutes).toBe(15);
      expect(tasks.find((t) => t.topic.name === "Long")?.estimatedMinutes).toBe(90);
    });

    it("is idempotent — re-running never duplicates or overwrites an existing plan", async () => {
      const { exam } = await setupExamWithTopics();

      await generateInitialPlan(exam.id);
      const secondRun = await generateInitialPlan(exam.id);

      expect(secondRun).toEqual({ scheduled: 0, unscheduled: 0 });
      expect(await prisma.revisionTask.count({ where: { examId: exam.id } })).toBe(3);
    });

    it("orders scheduling by priority — a high-importance hard topic lands no later than a low-importance easy one", async () => {
      const { exam } = await setupExamWithTopics([
        { name: "Low priority", importance: "low", difficulty: "easy" },
        { name: "High priority", importance: "high", difficulty: "hard" },
      ]);

      await generateInitialPlan(exam.id);

      const tasks = await prisma.revisionTask.findMany({ where: { examId: exam.id }, include: { topic: true } });
      const high = tasks.find((t) => t.topic.name === "High priority")!;
      const low = tasks.find((t) => t.topic.name === "Low priority")!;

      expect(high.priorityScore).toBeGreaterThan(low.priorityScore);
      expect(high.scheduledDate.getTime()).toBeLessThanOrEqual(low.scheduledDate.getTime());
    });

    it("reports topics it could not fit rather than silently dropping them", async () => {
      const user = await createUser();
      const exam = await createExam(user.id, { daysOut: 2 });
      // Only 1 hour a day → 51 usable minutes, so a 300-minute topic can never fit.
      await createFullAvailability(exam.id, "09:00", "10:00");
      await createSyllabus(exam.id, [{ name: "Enormous topic", estimatedRevisionMinutes: 300 }]);

      const result = await generateInitialPlan(exam.id);

      expect(result.scheduled).toBe(0);
      expect(result.unscheduled).toBe(1);
    });

    it("does nothing for an exam with no topics", async () => {
      const user = await createUser();
      const exam = await createExam(user.id);
      await createFullAvailability(exam.id);

      expect(await generateInitialPlan(exam.id)).toEqual({ scheduled: 0, unscheduled: 0 });
    });

    it("never schedules a task in the past", async () => {
      const { exam } = await setupExamWithTopics();

      await generateInitialPlan(exam.id);

      const today = startOfDay(new Date());
      const tasks = await prisma.revisionTask.findMany({ where: { examId: exam.id } });
      for (const task of tasks) {
        expect(task.scheduledDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
      }
    });
  });

  describe("scheduleTopicIntoPlan", () => {
    it("slots a newly added topic in without disturbing existing tasks", async () => {
      const { exam, syllabus } = await setupExamWithTopics();
      await generateInitialPlan(exam.id);

      const before = await prisma.revisionTask.findMany({ where: { examId: exam.id }, orderBy: { id: "asc" } });

      const newTopic = await prisma.topic.create({
        data: { chapterId: syllabus.chapter.id, name: "Added later", estimatedRevisionMinutes: 30 },
      });
      const placed = await scheduleTopicIntoPlan(exam.id, newTopic.id);

      expect(placed).toBe(true);

      const after = await prisma.revisionTask.findMany({ where: { examId: exam.id }, orderBy: { id: "asc" } });
      expect(after).toHaveLength(before.length + 1);

      // Every pre-existing task keeps its original date — adding a topic must not reshuffle the plan.
      for (const original of before) {
        const stillThere = after.find((t) => t.id === original.id)!;
        expect(stillThere.scheduledDate.getTime()).toBe(original.scheduledDate.getTime());
      }
    });

    it("returns false when the new topic cannot fit in the remaining window", async () => {
      const user = await createUser();
      const exam = await createExam(user.id, { daysOut: 2 });
      await createFullAvailability(exam.id, "09:00", "10:00");
      const syllabus = await createSyllabus(exam.id, [{ name: "Existing", estimatedRevisionMinutes: 30 }]);
      await generateInitialPlan(exam.id);

      const huge = await prisma.topic.create({
        data: { chapterId: syllabus.chapter.id, name: "Too big", estimatedRevisionMinutes: 400 },
      });

      expect(await scheduleTopicIntoPlan(exam.id, huge.id)).toBe(false);
    });
  });

  describe("completeRevisionTask", () => {
    it("marks the task complete, writes history, and schedules the next revision", async () => {
      const { exam } = await setupExamWithTopics([{ name: "Only topic" }]);
      await generateInitialPlan(exam.id);
      const task = await prisma.revisionTask.findFirstOrThrow({ where: { examId: exam.id } });

      await completeRevisionTask(task.id, "okay");

      const completed = await prisma.revisionTask.findUniqueOrThrow({ where: { id: task.id } });
      expect(completed.status).toBe("completed");
      expect(completed.completedAt).not.toBeNull();

      const history = await prisma.revisionHistory.findMany({ where: { topicId: task.topicId } });
      expect(history).toHaveLength(1);
      expect(history[0].confidence).toBe("okay");
      expect(history[0].revisionNumber).toBe(1);

      const next = await prisma.revisionTask.findFirstOrThrow({ where: { topicId: task.topicId, revisionNumber: 2 } });
      expect(next.status).toBe("scheduled");
      expect(next.scheduledDate.getTime()).toBeGreaterThan(completed.scheduledDate.getTime());
    });

    it("spaces the next revision further out after strong confidence than after weak", async () => {
      const { exam, syllabus } = await setupExamWithTopics([{ name: "A" }, { name: "B" }]);
      await generateInitialPlan(exam.id);

      const taskA = await prisma.revisionTask.findFirstOrThrow({ where: { topicId: syllabus.topics[0].id } });
      const taskB = await prisma.revisionTask.findFirstOrThrow({ where: { topicId: syllabus.topics[1].id } });

      await completeRevisionTask(taskA.id, "strong");
      await completeRevisionTask(taskB.id, "weak");

      const nextA = await prisma.revisionTask.findFirstOrThrow({ where: { topicId: syllabus.topics[0].id, revisionNumber: 2 } });
      const nextB = await prisma.revisionTask.findFirstOrThrow({ where: { topicId: syllabus.topics[1].id, revisionNumber: 2 } });

      expect(nextA.scheduledDate.getTime()).toBeGreaterThan(nextB.scheduledDate.getTime());
    });

    it("records completion without a confidence rating", async () => {
      const { exam } = await setupExamWithTopics([{ name: "Only topic" }]);
      await generateInitialPlan(exam.id);
      const task = await prisma.revisionTask.findFirstOrThrow({ where: { examId: exam.id } });

      await completeRevisionTask(task.id);

      const history = await prisma.revisionHistory.findFirstOrThrow({ where: { topicId: task.topicId } });
      expect(history.confidence).toBeNull();
    });

    it("does not schedule another revision when the exam is within a day", async () => {
      const user = await createUser();
      const exam = await createExam(user.id, { daysOut: 1 });
      await createFullAvailability(exam.id);
      await createSyllabus(exam.id, [{ name: "Last minute topic" }]);
      await generateInitialPlan(exam.id);

      const task = await prisma.revisionTask.findFirstOrThrow({ where: { examId: exam.id } });
      await completeRevisionTask(task.id, "weak");

      const followUps = await prisma.revisionTask.findMany({ where: { topicId: task.topicId, revisionNumber: 2 } });
      expect(followUps).toHaveLength(0);
    });
  });

  describe("syncOverdueTasks and today's list", () => {
    it("flips a past-due scheduled task to overdue", async () => {
      const { exam } = await setupExamWithTopics([{ name: "Forgotten topic" }]);
      await generateInitialPlan(exam.id);
      const task = await prisma.revisionTask.findFirstOrThrow({ where: { examId: exam.id } });

      await prisma.revisionTask.update({
        where: { id: task.id },
        data: { scheduledDate: startOfDay(addDays(new Date(), -3)) },
      });
      await syncOverdueTasks(exam.id);

      expect((await prisma.revisionTask.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("overdue");
    });

    it("never marks a completed task overdue", async () => {
      const { exam } = await setupExamWithTopics([{ name: "Done early" }]);
      await generateInitialPlan(exam.id);
      const task = await prisma.revisionTask.findFirstOrThrow({ where: { examId: exam.id } });
      await completeRevisionTask(task.id, "strong");

      await prisma.revisionTask.update({
        where: { id: task.id },
        data: { scheduledDate: startOfDay(addDays(new Date(), -5)) },
      });
      await syncOverdueTasks(exam.id);

      expect((await prisma.revisionTask.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("completed");
    });

    it("returns overdue tasks ahead of tasks merely due today", async () => {
      const { exam, syllabus } = await setupExamWithTopics([{ name: "Old" }, { name: "New" }]);
      await generateInitialPlan(exam.id);

      const oldTask = await prisma.revisionTask.findFirstOrThrow({ where: { topicId: syllabus.topics[0].id } });
      await prisma.revisionTask.update({
        where: { id: oldTask.id },
        data: { scheduledDate: startOfDay(addDays(new Date(), -2)) },
      });
      await prisma.revisionTask.updateMany({
        where: { topicId: syllabus.topics[1].id },
        data: { scheduledDate: startOfDay(new Date()) },
      });

      const tasks = await getTodaysTasks(exam.id);

      expect(tasks.length).toBeGreaterThanOrEqual(2);
      expect(tasks[0].status).toBe("overdue");
    });

    it("excludes tasks scheduled for a future date", async () => {
      const { exam } = await setupExamWithTopics([{ name: "Later" }]);
      await generateInitialPlan(exam.id);
      await prisma.revisionTask.updateMany({
        where: { examId: exam.id },
        data: { scheduledDate: startOfDay(addDays(new Date(), 5)) },
      });

      expect(await getTodaysTasks(exam.id)).toHaveLength(0);
    });
  });

  describe("getRevisionProgressSummary", () => {
    it("counts total, revised, due and overdue accurately", async () => {
      const { exam, syllabus } = await setupExamWithTopics([{ name: "A" }, { name: "B" }, { name: "C" }]);
      await generateInitialPlan(exam.id);

      // Complete one topic, make another overdue, leave the third scheduled.
      const taskA = await prisma.revisionTask.findFirstOrThrow({ where: { topicId: syllabus.topics[0].id } });
      await completeRevisionTask(taskA.id, "okay");

      const taskB = await prisma.revisionTask.findFirstOrThrow({ where: { topicId: syllabus.topics[1].id, status: "scheduled" } });
      await prisma.revisionTask.update({
        where: { id: taskB.id },
        data: { scheduledDate: startOfDay(addDays(new Date(), -1)) },
      });

      const summary = await getRevisionProgressSummary(exam.id);

      expect(summary.totalTopics).toBe(3);
      expect(summary.revisedTopics).toBe(1); // only A has revision history
      expect(summary.overdue).toBe(1); // B
    });

    it("reports zeroes for a syllabus with no plan yet", async () => {
      const { exam } = await setupExamWithTopics();

      const summary = await getRevisionProgressSummary(exam.id);

      expect(summary.totalTopics).toBe(3);
      expect(summary.revisedTopics).toBe(0);
      expect(summary.overdue).toBe(0);
      expect(summary.dueToday).toBe(0);
    });
  });
});
