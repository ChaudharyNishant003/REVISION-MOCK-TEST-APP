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
import { calculateAttemptScore } from "@/lib/mockTests/scoring";

describe("Mock tests", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  async function setupTestWithQuestions(count = 5) {
    const user = await createUser();
    const exam = await createExam(user.id);
    await createFullAvailability(exam.id);
    const { topics } = await createSyllabus(exam.id, [{ name: "Depreciation" }]);
    const set = await createQuestionSet(exam.id);

    const questions = [];
    for (let i = 0; i < count; i++) {
      questions.push(
        await createQuestion(set.id, {
          text: `Question ${i + 1}`,
          options: ["Correct answer", "Wrong answer", "Also wrong"],
          correctIndex: 0,
          topicId: topics[0].id,
        })
      );
    }

    const mockTest = await createMockTest(exam.id, questions.map((q) => q.id), {
      marksPerCorrect: 2,
      negativeMarksPerIncorrect: 0.5,
    });

    return { user, exam, set, questions, mockTest, topic: topics[0] };
  }

  describe("attempt snapshots", () => {
    it("captures question text, options and correct answer at the moment the test starts", async () => {
      const { user, mockTest, questions } = await setupTestWithQuestions(2);

      const attempt = await startAttempt(mockTest.id, user.id);

      expect(attempt.attemptQuestions).toHaveLength(2);
      const first = attempt.attemptQuestions[0];
      expect(first.questionTextSnapshot).toBe(questions[0].questionText);
      expect(first.correctAnswerSnapshot).toBe("A");
      expect(JSON.parse(first.optionsSnapshot)).toEqual([
        { label: "A", text: "Correct answer" },
        { label: "B", text: "Wrong answer" },
        { label: "C", text: "Also wrong" },
      ]);
    });

    it("keeps a past attempt intact when the source question is edited afterwards", async () => {
      const { user, mockTest, questions } = await setupTestWithQuestions(1);
      const attempt = await startAttempt(mockTest.id, user.id);
      const originalSnapshot = attempt.attemptQuestions[0].questionTextSnapshot;

      // Someone edits the question in the bank after the attempt was taken.
      await prisma.question.update({
        where: { id: questions[0].id },
        data: { questionText: "COMPLETELY REWRITTEN QUESTION" },
      });
      await prisma.questionOption.updateMany({
        where: { questionId: questions[0].id },
        data: { text: "rewritten option" },
      });

      const reread = await prisma.attemptQuestion.findFirstOrThrow({ where: { testAttemptId: attempt.id } });
      expect(reread.questionTextSnapshot).toBe(originalSnapshot);
      expect(reread.questionTextSnapshot).not.toBe("COMPLETELY REWRITTEN QUESTION");
      expect(reread.optionsSnapshot).toContain("Correct answer");
    });

    it("survives the source question being deleted entirely", async () => {
      const { user, mockTest, questions } = await setupTestWithQuestions(1);
      const attempt = await startAttempt(mockTest.id, user.id);

      await prisma.question.delete({ where: { id: questions[0].id } });

      const stillThere = await prisma.attemptQuestion.findFirst({ where: { testAttemptId: attempt.id } });
      expect(stillThere).not.toBeNull();
      expect(stillThere!.questionTextSnapshot).toBe("Question 1");
    });

    it("initializes every answer as not_visited", async () => {
      const { user, mockTest } = await setupTestWithQuestions(3);
      const attempt = await startAttempt(mockTest.id, user.id);

      const answers = await prisma.attemptAnswer.findMany({
        where: { attemptQuestion: { testAttemptId: attempt.id } },
      });
      expect(answers).toHaveLength(3);
      expect(answers.every((a) => a.answerStatus === "not_visited")).toBe(true);
      expect(answers.every((a) => a.selectedOptionLabel === null)).toBe(true);
    });

    it("sets the deadline from the test's configured time limit", async () => {
      const { user, exam, questions } = await setupTestWithQuestions(1);
      const timed = await createMockTest(exam.id, [questions[0].id], { timeLimitMinutes: 45, name: "Timed" });

      const attempt = await startAttempt(timed.id, user.id, 45);

      const durationMinutes = (attempt.endsAt.getTime() - attempt.startedAt.getTime()) / 60_000;
      expect(durationMinutes).toBeCloseTo(45, 1);
    });
  });

  describe("scoring a real attempt", () => {
    it("scores a mixed attempt exactly as the marking scheme dictates", async () => {
      const { user, mockTest } = await setupTestWithQuestions(5);
      const attempt = await startAttempt(mockTest.id, user.id);

      // 3 correct ("A"), 1 wrong ("B"), 1 skipped (null)
      await answerQuestion(attempt.attemptQuestions[0].id, "A");
      await answerQuestion(attempt.attemptQuestions[1].id, "A");
      await answerQuestion(attempt.attemptQuestions[2].id, "A");
      await answerQuestion(attempt.attemptQuestions[3].id, "B");
      await answerQuestion(attempt.attemptQuestions[4].id, null);

      const withAnswers = await prisma.attemptQuestion.findMany({
        where: { testAttemptId: attempt.id },
        include: { answer: true },
        orderBy: { sortOrder: "asc" },
      });

      const result = calculateAttemptScore(
        withAnswers.map((aq) => ({
          selectedLabel: aq.answer?.selectedOptionLabel ?? null,
          correctLabel: aq.correctAnswerSnapshot,
        })),
        mockTest.marksPerCorrect,
        mockTest.negativeMarksPerIncorrect
      );

      expect(result.correct).toBe(3);
      expect(result.incorrect).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.score).toBe(5.5); // 3*2 - 1*0.5
      expect(result.accuracy).toBe(75); // 3 of 4 attempted
    });

    it("persists the final result on the attempt row", async () => {
      const { user, mockTest } = await setupTestWithQuestions(2);
      const attempt = await startAttempt(mockTest.id, user.id);
      await answerQuestion(attempt.attemptQuestions[0].id, "A");
      await answerQuestion(attempt.attemptQuestions[1].id, "B");

      await prisma.testAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "submitted",
          submittedAt: new Date(),
          score: 1.5,
          correctCount: 1,
          incorrectCount: 1,
          skippedCount: 0,
          attemptedCount: 2,
          accuracy: 50,
        },
      });

      const submitted = await prisma.testAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
      expect(submitted.status).toBe("submitted");
      expect(submitted.score).toBe(1.5);
      expect(submitted.accuracy).toBe(50);
      expect(submitted.correctCount! + submitted.incorrectCount! + submitted.skippedCount!).toBe(2);
    });
  });

  describe("archiving", () => {
    it("removes an archived test from the ready-to-sit list", async () => {
      const { exam, mockTest } = await setupTestWithQuestions(1);

      const readyBefore = await prisma.mockTest.findMany({
        where: { examId: exam.id, status: { not: "archived" } },
      });
      expect(readyBefore.map((t) => t.id)).toContain(mockTest.id);

      await prisma.mockTest.update({ where: { id: mockTest.id }, data: { status: "archived" } });

      const readyAfter = await prisma.mockTest.findMany({
        where: { examId: exam.id, status: { not: "archived" } },
      });
      expect(readyAfter.map((t) => t.id)).not.toContain(mockTest.id);
    });

    it("keeps past attempts and their results fully intact after archiving", async () => {
      const { user, mockTest } = await setupTestWithQuestions(2);
      const attempt = await startAttempt(mockTest.id, user.id);
      await prisma.testAttempt.update({
        where: { id: attempt.id },
        data: { status: "submitted", submittedAt: new Date(), score: 4, accuracy: 100 },
      });

      await prisma.mockTest.update({ where: { id: mockTest.id }, data: { status: "archived" } });

      const history = await prisma.testAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
        include: { mockTest: true, attemptQuestions: true },
      });
      expect(history.score).toBe(4);
      expect(history.attemptQuestions).toHaveLength(2);
      expect(history.mockTest.name).toBe("Mock Test 1");
    });
  });

  describe("eligibility rules", () => {
    it("only approved questions with a confirmed answer qualify for a test", async () => {
      const { exam, set, questions } = await setupTestWithQuestions(2);

      const draft = await createQuestion(set.id, {
        text: "Still under review",
        options: ["A", "B"],
        correctIndex: 0,
        approvalStatus: "needs_review",
      });
      const answerless = await prisma.question.create({
        data: { questionSetId: set.id, questionText: "No answer confirmed", approvalStatus: "approved" },
      });

      const eligible = await prisma.question.findMany({
        where: {
          questionSet: { examId: exam.id },
          approvalStatus: "approved",
          correctOptionId: { not: null },
        },
      });

      const eligibleIds = eligible.map((q) => q.id);
      expect(eligibleIds).toEqual(expect.arrayContaining(questions.map((q) => q.id)));
      expect(eligibleIds).not.toContain(draft.id);
      expect(eligibleIds).not.toContain(answerless.id);
    });
  });
});
