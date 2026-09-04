import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { addDays, startOfDay } from "@/lib/scheduler/dates";

/**
 * Test data builders. Each returns the created row(s) so tests can assert against real ids.
 * Defaults are chosen to be "boring but valid" — override only what a given test cares about.
 */

let counter = 0;
const uniq = () => `${Date.now()}-${counter++}`;

export async function createUser(overrides: { email?: string; name?: string } = {}) {
  return prisma.user.create({
    data: {
      name: overrides.name ?? "Test Candidate",
      email: overrides.email ?? `user-${uniq()}@test.local`,
      passwordHash: await bcrypt.hash("TestPass123!", 4), // low cost: tests don't need slow hashing
    },
  });
}

export async function createExam(userId: string, overrides: { daysOut?: number; name?: string } = {}) {
  return prisma.exam.create({
    data: {
      userId,
      name: overrides.name ?? "Uttarakhand Accountant Examination",
      examDate: addDays(startOfDay(new Date()), overrides.daysOut ?? 60),
    },
  });
}

/** Availability every day of the week, so capacity is never the constraint unless a test wants it to be. */
export async function createFullAvailability(examId: string, startTime = "09:00", endTime = "17:00") {
  await prisma.studyAvailability.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ examId, dayOfWeek, startTime, endTime })),
  });
  return prisma.studyAvailability.findMany({ where: { examId } });
}

export type TopicSpec = {
  name: string;
  estimatedRevisionMinutes?: number;
  difficulty?: "easy" | "medium" | "hard";
  importance?: "low" | "medium" | "high";
};

/** Creates one subject + one chapter + the requested topics under it. */
export async function createSyllabus(examId: string, topics: TopicSpec[], names = { subject: "Accounting", chapter: "Depreciation" }) {
  const subject = await prisma.subject.create({ data: { examId, name: names.subject, sortOrder: 0 } });
  const chapter = await prisma.chapter.create({ data: { subjectId: subject.id, name: names.chapter, sortOrder: 0 } });

  const created = [];
  for (const topic of topics) {
    created.push(
      await prisma.topic.create({
        data: {
          chapterId: chapter.id,
          name: topic.name,
          estimatedRevisionMinutes: topic.estimatedRevisionMinutes ?? 30,
          difficulty: topic.difficulty ?? "medium",
          importance: topic.importance ?? "medium",
        },
      })
    );
  }

  return { subject, chapter, topics: created };
}

export async function createQuestionSet(examId: string, name = "Practice Set 1") {
  return prisma.questionSet.create({ data: { examId, name } });
}

export type QuestionSpec = {
  text: string;
  options: string[];
  correctIndex: number;
  topicId?: string | null;
  approvalStatus?: string;
};

/** Creates a question with lettered options (A, B, C…) and its correctOptionId resolved. */
export async function createQuestion(questionSetId: string, spec: QuestionSpec) {
  const question = await prisma.question.create({
    data: {
      questionSetId,
      topicId: spec.topicId ?? null,
      questionText: spec.text,
      approvalStatus: spec.approvalStatus ?? "approved",
      options: {
        create: spec.options.map((text, i) => ({ label: String.fromCharCode(65 + i), text, sortOrder: i })),
      },
    },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });

  const correctOption = question.options[spec.correctIndex];
  return prisma.question.update({
    where: { id: question.id },
    data: { correctOptionId: correctOption.id },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function createMockTest(
  examId: string,
  questionIds: string[],
  overrides: { marksPerCorrect?: number; negativeMarksPerIncorrect?: number; timeLimitMinutes?: number; name?: string } = {}
) {
  return prisma.mockTest.create({
    data: {
      examId,
      name: overrides.name ?? "Mock Test 1",
      timeLimitMinutes: overrides.timeLimitMinutes ?? 30,
      marksPerCorrect: overrides.marksPerCorrect ?? 2,
      negativeMarksPerIncorrect: overrides.negativeMarksPerIncorrect ?? 0.5,
      status: "ready",
      testQuestions: { create: questionIds.map((questionId, sortOrder) => ({ questionId, sortOrder })) },
    },
  });
}

/**
 * Mirrors startTestAttemptAction: snapshots each question into AttemptQuestion/AttemptAnswer.
 * (The action itself can't run outside a Next.js request — E2E covers that path.)
 */
export async function startAttempt(mockTestId: string, userId: string, timeLimitMinutes = 30) {
  const mockTest = await prisma.mockTest.findUniqueOrThrow({
    where: { id: mockTestId },
    include: {
      testQuestions: {
        orderBy: { sortOrder: "asc" },
        include: { question: { include: { options: { orderBy: { sortOrder: "asc" } } } } },
      },
    },
  });

  const now = new Date();
  const attempt = await prisma.testAttempt.create({
    data: {
      mockTestId,
      userId,
      startedAt: now,
      endsAt: new Date(now.getTime() + timeLimitMinutes * 60_000),
      status: "in_progress",
    },
  });

  for (const [index, tq] of mockTest.testQuestions.entries()) {
    const correctOption = tq.question.options.find((o) => o.id === tq.question.correctOptionId);
    const attemptQuestion = await prisma.attemptQuestion.create({
      data: {
        testAttemptId: attempt.id,
        originalQuestionId: tq.questionId,
        topicId: tq.question.topicId,
        questionTextSnapshot: tq.question.questionText,
        optionsSnapshot: JSON.stringify(tq.question.options.map((o) => ({ label: o.label, text: o.text }))),
        correctAnswerSnapshot: correctOption?.label ?? "",
        sortOrder: index,
      },
    });
    await prisma.attemptAnswer.create({
      data: { attemptQuestionId: attemptQuestion.id, answerStatus: "not_visited" },
    });
  }

  return prisma.testAttempt.findUniqueOrThrow({
    where: { id: attempt.id },
    include: { attemptQuestions: { orderBy: { sortOrder: "asc" }, include: { answer: true } } },
  });
}

/** Answers a specific question within an attempt, mirroring saveAnswerAction's persistence. */
export async function answerQuestion(attemptQuestionId: string, selectedOptionLabel: string | null, timeSpentSeconds = 30) {
  return prisma.attemptAnswer.update({
    where: { attemptQuestionId },
    data: {
      selectedOptionLabel,
      answerStatus: selectedOptionLabel ? "answered" : "unanswered",
      timeSpentSeconds,
      firstAnsweredAt: selectedOptionLabel ? new Date() : null,
      lastAnsweredAt: selectedOptionLabel ? new Date() : null,
    },
  });
}
