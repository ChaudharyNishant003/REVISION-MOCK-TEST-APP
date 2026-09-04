import { describe, it, expect, beforeAll, beforeEach } from "vitest";

import { prisma } from "@/lib/prisma";
import { setupTestDatabase, resetDatabase } from "../setup/testDb";
import { createUser, createExam, createFullAvailability, createSyllabus } from "../fixtures/factories";
import { generateInitialPlan } from "@/lib/scheduler/generatePlan";
import { reprioritizeTopic } from "@/lib/scheduler/reprioritize";

/**
 * The adaptive loop is the product's central claim: a weak mock-test result should push
 * that topic up tomorrow's revision list. Critically, it must adjust *priority only* —
 * if it moved dates or created tasks, one bad test would rebuild the candidate's plan.
 */
describe("Adaptive revision priorities", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  async function setupTopicWithPlan() {
    const user = await createUser();
    const exam = await createExam(user.id, { daysOut: 60 });
    await createFullAvailability(exam.id);
    const { topics } = await createSyllabus(exam.id, [{ name: "Depreciation" }]);
    await generateInitialPlan(exam.id);
    const topic = topics[0];
    const task = await prisma.revisionTask.findFirstOrThrow({ where: { topicId: topic.id } });
    return { user, exam, topic, task };
  }

  it("raises a topic's priority after weak mock-test performance", async () => {
    const { topic, task } = await setupTopicWithPlan();
    const scoreBefore = task.priorityScore;

    await prisma.topicPerformanceProfile.create({
      data: { topicId: topic.id, questionsAttempted: 10, correctAnswers: 3, accuracy: 30, recentAccuracy: 30 },
    });
    await reprioritizeTopic(topic.id);

    const after = await prisma.revisionTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(after.priorityScore).toBeGreaterThan(scoreBefore);
  });

  it("lowers a topic's priority after strong mock-test performance", async () => {
    const { topic, task } = await setupTopicWithPlan();
    const scoreBefore = task.priorityScore;

    await prisma.topicPerformanceProfile.create({
      data: { topicId: topic.id, questionsAttempted: 10, correctAnswers: 10, accuracy: 95, recentAccuracy: 95 },
    });
    await reprioritizeTopic(topic.id);

    const after = await prisma.revisionTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(after.priorityScore).toBeLessThan(scoreBefore);
  });

  it("ranks a weak topic above a strong one after both are reprioritized", async () => {
    const user = await createUser();
    const exam = await createExam(user.id, { daysOut: 60 });
    await createFullAvailability(exam.id);
    const { topics } = await createSyllabus(exam.id, [{ name: "Weak topic" }, { name: "Strong topic" }]);
    await generateInitialPlan(exam.id);

    await prisma.topicPerformanceProfile.create({
      data: { topicId: topics[0].id, questionsAttempted: 10, correctAnswers: 2, accuracy: 20, recentAccuracy: 20 },
    });
    await prisma.topicPerformanceProfile.create({
      data: { topicId: topics[1].id, questionsAttempted: 10, correctAnswers: 10, accuracy: 98, recentAccuracy: 98 },
    });

    await reprioritizeTopic(topics[0].id);
    await reprioritizeTopic(topics[1].id);

    const weakTask = await prisma.revisionTask.findFirstOrThrow({ where: { topicId: topics[0].id } });
    const strongTask = await prisma.revisionTask.findFirstOrThrow({ where: { topicId: topics[1].id } });

    expect(weakTask.priorityScore).toBeGreaterThan(strongTask.priorityScore);
  });

  it("never moves a scheduled date — one bad test must not rebuild the plan", async () => {
    const { topic, task } = await setupTopicWithPlan();
    const dateBefore = task.scheduledDate.getTime();

    await prisma.topicPerformanceProfile.create({
      data: { topicId: topic.id, questionsAttempted: 10, correctAnswers: 1, accuracy: 10, recentAccuracy: 10 },
    });
    await reprioritizeTopic(topic.id);

    const after = await prisma.revisionTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(after.scheduledDate.getTime()).toBe(dateBefore);
  });

  it("never creates or deletes tasks", async () => {
    const { topic, exam } = await setupTopicWithPlan();
    const countBefore = await prisma.revisionTask.count({ where: { examId: exam.id } });

    await prisma.topicPerformanceProfile.create({
      data: { topicId: topic.id, questionsAttempted: 10, correctAnswers: 1, accuracy: 10, recentAccuracy: 10 },
    });
    await reprioritizeTopic(topic.id);

    expect(await prisma.revisionTask.count({ where: { examId: exam.id } })).toBe(countBefore);
  });

  it("leaves completed tasks untouched — only open work gets reprioritized", async () => {
    const { topic, task } = await setupTopicWithPlan();
    await prisma.revisionTask.update({
      where: { id: task.id },
      data: { status: "completed", completedAt: new Date() },
    });
    const scoreBefore = task.priorityScore;

    await prisma.topicPerformanceProfile.create({
      data: { topicId: topic.id, questionsAttempted: 10, correctAnswers: 1, accuracy: 10, recentAccuracy: 10 },
    });
    await reprioritizeTopic(topic.id);

    const after = await prisma.revisionTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(after.priorityScore).toBe(scoreBefore);
  });

  it("prefers recent accuracy over lifetime accuracy when both exist", async () => {
    const { topic, task } = await setupTopicWithPlan();

    // Lifetime looks fine, but recent performance collapsed — the recent signal should win.
    await prisma.topicPerformanceProfile.create({
      data: { topicId: topic.id, questionsAttempted: 20, correctAnswers: 18, accuracy: 90, recentAccuracy: 20 },
    });
    await reprioritizeTopic(topic.id);

    const after = await prisma.revisionTask.findUniqueOrThrow({ where: { id: task.id } });
    // A 20% recent accuracy adds +18; a 90% lifetime accuracy would have subtracted 6.
    expect(after.priorityScore).toBeGreaterThan(task.priorityScore);
  });

  it("is a safe no-op for a topic with no open tasks", async () => {
    const { topic, task } = await setupTopicWithPlan();
    await prisma.revisionTask.delete({ where: { id: task.id } });

    await expect(reprioritizeTopic(topic.id)).resolves.toBeUndefined();
  });

  it("is a safe no-op for a topic that no longer exists", async () => {
    await expect(reprioritizeTopic("does-not-exist")).resolves.toBeUndefined();
  });
});
