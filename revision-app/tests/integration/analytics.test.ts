import { describe, it, expect, beforeAll, beforeEach } from "vitest";

import { prisma } from "@/lib/prisma";
import { setupTestDatabase, resetDatabase } from "../setup/testDb";
import {
  createUser,
  createExam,
  createFullAvailability,
  createSyllabus,
  createQuestionSet,
  createQuestion,
  createMockTest,
  startAttempt,
  answerQuestion,
} from "../fixtures/factories";
import { updateTopicPerformanceForAttempt } from "@/lib/analytics/updateTopicPerformance";

/**
 * Analytics tells the candidate which topics are weak. A wrong verdict here sends them
 * to study the wrong thing, so the band thresholds and the "not enough data" guard matter.
 * Thresholds per Document 04: <55 high_attention, <75 needs_attention, >=85 strong, else stable,
 * and nothing is labelled at all below 3 attempted questions.
 */
describe("Topic performance analytics", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  /**
   * Builds an exam with one topic and runs a submitted attempt where `correctCount` of
   * `questionCount` answers are right, then recomputes the topic's profile.
   */
  async function runAttemptWithAccuracy(questionCount: number, correctCount: number, timeSpentSeconds = 30) {
    const user = await createUser();
    const exam = await createExam(user.id);
    await createFullAvailability(exam.id);
    const { topics } = await createSyllabus(exam.id, [{ name: "Depreciation" }]);
    const topic = topics[0];
    const set = await createQuestionSet(exam.id);

    const questions = [];
    for (let i = 0; i < questionCount; i++) {
      questions.push(
        await createQuestion(set.id, {
          text: `Question ${i + 1}`,
          options: ["Right", "Wrong"],
          correctIndex: 0,
          topicId: topic.id,
        })
      );
    }

    const mockTest = await createMockTest(exam.id, questions.map((q) => q.id));
    const attempt = await startAttempt(mockTest.id, user.id);

    for (const [i, aq] of attempt.attemptQuestions.entries()) {
      // "A" is correct; "B" is wrong.
      await answerQuestion(aq.id, i < correctCount ? "A" : "B", timeSpentSeconds);
      await prisma.attemptAnswer.update({
        where: { attemptQuestionId: aq.id },
        data: { isCorrect: i < correctCount },
      });
    }

    await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: { status: "submitted", submittedAt: new Date() },
    });

    await updateTopicPerformanceForAttempt(attempt.id);

    const profile = await prisma.topicPerformanceProfile.findUniqueOrThrow({ where: { topicId: topic.id } });
    return { profile, topic, user, exam, attempt };
  }

  it("records counts and accuracy from a submitted attempt", async () => {
    const { profile } = await runAttemptWithAccuracy(4, 3);

    expect(profile.questionsAttempted).toBe(4);
    expect(profile.correctAnswers).toBe(3);
    expect(profile.incorrectAnswers).toBe(1);
    expect(profile.accuracy).toBe(75);
  });

  it("withholds a verdict below the minimum sample size — one bad question can't brand a topic weak", async () => {
    const { profile } = await runAttemptWithAccuracy(2, 0);

    expect(profile.questionsAttempted).toBe(2);
    expect(profile.accuracy).toBe(0);
    expect(profile.attentionLevel).toBe("limited_data");
  });

  it("assigns 'high_attention' below 55% accuracy", async () => {
    const { profile } = await runAttemptWithAccuracy(4, 2); // 50%
    expect(profile.attentionLevel).toBe("high_attention");
  });

  it("assigns 'needs_attention' between 55% and 75%", async () => {
    const { profile } = await runAttemptWithAccuracy(3, 2); // 66.7%
    expect(profile.attentionLevel).toBe("needs_attention");
  });

  it("assigns 'stable' between 75% and 85%", async () => {
    const { profile } = await runAttemptWithAccuracy(4, 3); // 75%
    expect(profile.attentionLevel).toBe("stable");
  });

  it("assigns 'strong' at or above 85%", async () => {
    const { profile } = await runAttemptWithAccuracy(4, 4); // 100%
    expect(profile.attentionLevel).toBe("strong");
  });

  it("computes average answer time across attempted questions", async () => {
    const { profile } = await runAttemptWithAccuracy(4, 3, 45);
    expect(profile.averageTimeSeconds).toBe(45);
  });

  it("excludes skipped questions from accuracy — skipping is not the same as being wrong", async () => {
    const user = await createUser();
    const exam = await createExam(user.id);
    await createFullAvailability(exam.id);
    const { topics } = await createSyllabus(exam.id, [{ name: "Depreciation" }]);
    const set = await createQuestionSet(exam.id);

    const questions = [];
    for (let i = 0; i < 4; i++) {
      questions.push(
        await createQuestion(set.id, { text: `Q${i}`, options: ["Right", "Wrong"], correctIndex: 0, topicId: topics[0].id })
      );
    }
    const mockTest = await createMockTest(exam.id, questions.map((q) => q.id));
    const attempt = await startAttempt(mockTest.id, user.id);

    // 3 correct, 1 skipped → accuracy should be 100% of what was attempted.
    for (const [i, aq] of attempt.attemptQuestions.entries()) {
      if (i === 3) {
        await answerQuestion(aq.id, null);
      } else {
        await answerQuestion(aq.id, "A");
        await prisma.attemptAnswer.update({ where: { attemptQuestionId: aq.id }, data: { isCorrect: true } });
      }
    }
    await prisma.testAttempt.update({ where: { id: attempt.id }, data: { status: "submitted", submittedAt: new Date() } });

    await updateTopicPerformanceForAttempt(attempt.id);

    const profile = await prisma.topicPerformanceProfile.findUniqueOrThrow({ where: { topicId: topics[0].id } });
    expect(profile.questionsAttempted).toBe(3);
    expect(profile.skippedAnswers).toBe(1);
    expect(profile.accuracy).toBe(100);
  });

  it("aggregates across multiple submitted attempts, not just the newest one", async () => {
    const { topic, user, exam, profile: firstProfile } = await runAttemptWithAccuracy(4, 4);
    expect(firstProfile.questionsAttempted).toBe(4);

    // A second, worse attempt on the same topic should drag the aggregate down.
    const set = await prisma.questionSet.findFirstOrThrow({ where: { examId: exam.id } });
    const moreQuestions = [];
    for (let i = 0; i < 4; i++) {
      moreQuestions.push(
        await createQuestion(set.id, { text: `Second round Q${i}`, options: ["Right", "Wrong"], correctIndex: 0, topicId: topic.id })
      );
    }
    const secondTest = await createMockTest(exam.id, moreQuestions.map((q) => q.id), { name: "Mock Test 2" });
    const secondAttempt = await startAttempt(secondTest.id, user.id);
    for (const aq of secondAttempt.attemptQuestions) {
      await answerQuestion(aq.id, "B");
      await prisma.attemptAnswer.update({ where: { attemptQuestionId: aq.id }, data: { isCorrect: false } });
    }
    await prisma.testAttempt.update({ where: { id: secondAttempt.id }, data: { status: "submitted", submittedAt: new Date() } });

    await updateTopicPerformanceForAttempt(secondAttempt.id);

    const updated = await prisma.topicPerformanceProfile.findUniqueOrThrow({ where: { topicId: topic.id } });
    expect(updated.questionsAttempted).toBe(8); // 4 + 4
    expect(updated.correctAnswers).toBe(4);
    expect(updated.accuracy).toBe(50);
  });

  it("ignores attempts that were never submitted", async () => {
    const user = await createUser();
    const exam = await createExam(user.id);
    await createFullAvailability(exam.id);
    const { topics } = await createSyllabus(exam.id, [{ name: "Depreciation" }]);
    const set = await createQuestionSet(exam.id);
    const questions = [];
    for (let i = 0; i < 3; i++) {
      questions.push(
        await createQuestion(set.id, { text: `Q${i}`, options: ["Right", "Wrong"], correctIndex: 0, topicId: topics[0].id })
      );
    }
    const mockTest = await createMockTest(exam.id, questions.map((q) => q.id));

    // A submitted attempt (all correct) plus an abandoned in-progress one (all wrong).
    const submitted = await startAttempt(mockTest.id, user.id);
    for (const aq of submitted.attemptQuestions) {
      await answerQuestion(aq.id, "A");
      await prisma.attemptAnswer.update({ where: { attemptQuestionId: aq.id }, data: { isCorrect: true } });
    }
    await prisma.testAttempt.update({ where: { id: submitted.id }, data: { status: "submitted", submittedAt: new Date() } });

    const abandoned = await startAttempt(mockTest.id, user.id);
    for (const aq of abandoned.attemptQuestions) {
      await answerQuestion(aq.id, "B");
      await prisma.attemptAnswer.update({ where: { attemptQuestionId: aq.id }, data: { isCorrect: false } });
    }
    // deliberately left as in_progress

    await updateTopicPerformanceForAttempt(submitted.id);

    const profile = await prisma.topicPerformanceProfile.findUniqueOrThrow({ where: { topicId: topics[0].id } });
    expect(profile.questionsAttempted).toBe(3); // only the submitted attempt counts
    expect(profile.accuracy).toBe(100);
  });

  it("sets a revision priority score that rises as accuracy falls", async () => {
    const weak = await runAttemptWithAccuracy(4, 1); // 25%
    await resetDatabase();
    const strong = await runAttemptWithAccuracy(4, 4); // 100%

    expect(weak.profile.revisionPriorityScore).toBeGreaterThan(strong.profile.revisionPriorityScore);
  });

  describe("performance trend", () => {
    /**
     * Runs two attempts on the same topic, an older one and a newer one, so the trend
     * comparison is chronologically meaningful (this is how it works in real use —
     * answers are ordered by the attempt's submission time).
     */
    async function runTwoAttempts(olderCorrect: number, newerCorrect: number, questionsPerAttempt = 4) {
      const user = await createUser();
      const exam = await createExam(user.id);
      await createFullAvailability(exam.id);
      const { topics } = await createSyllabus(exam.id, [{ name: "Depreciation" }]);
      const topic = topics[0];
      const set = await createQuestionSet(exam.id);

      async function attemptRound(correctCount: number, submittedAt: Date, label: string) {
        const questions = [];
        for (let i = 0; i < questionsPerAttempt; i++) {
          questions.push(
            await createQuestion(set.id, {
              text: `${label} Q${i}`,
              options: ["Right", "Wrong"],
              correctIndex: 0,
              topicId: topic.id,
            })
          );
        }
        const mockTest = await createMockTest(exam.id, questions.map((q) => q.id), { name: `${label} test` });
        const attempt = await startAttempt(mockTest.id, user.id);
        for (const [i, aq] of attempt.attemptQuestions.entries()) {
          await answerQuestion(aq.id, i < correctCount ? "A" : "B");
          await prisma.attemptAnswer.update({
            where: { attemptQuestionId: aq.id },
            data: { isCorrect: i < correctCount },
          });
        }
        await prisma.testAttempt.update({ where: { id: attempt.id }, data: { status: "submitted", submittedAt } });
        return attempt;
      }

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      await attemptRound(olderCorrect, weekAgo, "Older");
      const newer = await attemptRound(newerCorrect, new Date(), "Newer");

      await updateTopicPerformanceForAttempt(newer.id);
      return prisma.topicPerformanceProfile.findUniqueOrThrow({ where: { topicId: topic.id } });
    }

    it("reports no trend when there is too little data to compare", async () => {
      const { profile } = await runAttemptWithAccuracy(4, 2);
      expect(profile.performanceTrend).toBeNull();
    });

    it("reports 'improving' when recent accuracy is clearly better than earlier", async () => {
      // Older attempt: 1/4 correct (25%). Newer attempt: 4/4 correct (100%).
      const profile = await runTwoAttempts(1, 4);

      expect(profile.questionsAttempted).toBe(8);
      expect(profile.performanceTrend).toBe("improving");
    });

    it("reports 'declining' when recent accuracy is clearly worse than earlier", async () => {
      // Older attempt: 4/4 correct. Newer attempt: 1/4 correct.
      const profile = await runTwoAttempts(4, 1);

      expect(profile.performanceTrend).toBe("declining");
    });

    it("reports 'stable' when accuracy barely moved", async () => {
      const profile = await runTwoAttempts(2, 2);

      expect(profile.performanceTrend).toBe("stable");
    });

    /** Regression guard for DEFECT-002: a trend must appear at the 6-answer threshold. */
    it("produces a trend once 6 answers exist, not only past 10", async () => {
      const profile = await runTwoAttempts(0, 3, 3); // 6 answers total

      expect(profile.questionsAttempted).toBe(6);
      expect(profile.performanceTrend).not.toBeNull();
    });
  });
});
