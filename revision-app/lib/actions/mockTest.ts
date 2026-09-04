"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { updateTopicPerformanceForAttempt } from "@/lib/analytics/updateTopicPerformance";
import { calculateAttemptScore } from "@/lib/mockTests/scoring";
import { resolveAnswerStatus, cappedTimeIncrement } from "@/lib/mockTests/answerStatus";

/** Starts a fresh, timed attempt: snapshots questions/options so later edits never change history (Document 03 §13). */
export async function startTestAttemptAction(mockTestId: string) {
  const userId = await requireUserId();

  const mockTest = await prisma.mockTest.findUnique({
    where: { id: mockTestId },
    include: {
      exam: true,
      testQuestions: {
        orderBy: { sortOrder: "asc" },
        include: { question: { include: { options: { orderBy: { sortOrder: "asc" } } } } },
      },
    },
  });
  if (!mockTest || mockTest.exam.userId !== userId) {
    throw new Error("Mock test not found");
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + mockTest.timeLimitMinutes * 60_000);

  const attempt = await prisma.testAttempt.create({
    data: {
      mockTestId: mockTest.id,
      userId,
      startedAt: now,
      endsAt,
      status: "in_progress",
    },
  });

  for (let i = 0; i < mockTest.testQuestions.length; i++) {
    const tq = mockTest.testQuestions[i];
    const correctOption = tq.question.options.find((o) => o.id === tq.question.correctOptionId);

    const attemptQuestion = await prisma.attemptQuestion.create({
      data: {
        testAttemptId: attempt.id,
        originalQuestionId: tq.questionId,
        topicId: tq.question.topicId,
        questionTextSnapshot: tq.question.questionText,
        optionsSnapshot: JSON.stringify(
          tq.question.options.map((o) => ({ label: o.label, text: o.text }))
        ),
        correctAnswerSnapshot: correctOption?.label ?? "",
        sortOrder: i,
      },
    });

    await prisma.attemptAnswer.create({
      data: { attemptQuestionId: attemptQuestion.id, answerStatus: "not_visited" },
    });
  }

  redirect(`/mock-tests/${attempt.id}`);
}

async function assertOwnedAttemptQuestion(attemptQuestionId: string, userId: string) {
  const aq = await prisma.attemptQuestion.findUnique({
    where: { id: attemptQuestionId },
    include: { testAttempt: true },
  });
  if (!aq || aq.testAttempt.userId !== userId) return null;
  return aq;
}

export async function saveAnswerAction(
  attemptQuestionId: string,
  selectedOptionLabel: string | null,
  isMarkedForReview: boolean
) {
  const userId = await requireUserId();
  const aq = await assertOwnedAttemptQuestion(attemptQuestionId, userId);
  if (!aq || aq.testAttempt.status !== "in_progress") return;

  const existing = await prisma.attemptAnswer.findUnique({ where: { attemptQuestionId } });
  const now = new Date();
  const answered = selectedOptionLabel != null;
  const changed = existing?.selectedOptionLabel != null && existing.selectedOptionLabel !== selectedOptionLabel;

  const answerStatus = resolveAnswerStatus(answered, isMarkedForReview);

  await prisma.attemptAnswer.update({
    where: { attemptQuestionId },
    data: {
      selectedOptionLabel,
      isMarkedForReview,
      answerStatus,
      firstAnsweredAt: existing?.firstAnsweredAt ?? (answered ? now : null),
      lastAnsweredAt: answered ? now : existing?.lastAnsweredAt,
      answerChangeCount: changed ? (existing?.answerChangeCount ?? 0) + 1 : existing?.answerChangeCount ?? 0,
    },
  });
}

/** Adds active viewing time to a question, per Document 03 §18. Ignored once the attempt is final. */
export async function addTimeSpentAction(attemptQuestionId: string, deltaSeconds: number) {
  const userId = await requireUserId();
  const aq = await assertOwnedAttemptQuestion(attemptQuestionId, userId);
  if (!aq || aq.testAttempt.status !== "in_progress") return;
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;

  await prisma.attemptAnswer.update({
    where: { attemptQuestionId },
    data: { timeSpentSeconds: { increment: cappedTimeIncrement(deltaSeconds) } },
  });
}

/** Deterministic scoring per Document 03 §25 — never touched by AI. */
export async function submitAttemptAction(attemptId: string) {
  const userId = await requireUserId();

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: { mockTest: true, attemptQuestions: { include: { answer: true } } },
  });
  if (!attempt || attempt.userId !== userId) throw new Error("Attempt not found");
  if (attempt.status !== "in_progress") {
    redirect(`/mock-tests/${attemptId}/result`);
  }

  const isExpired = new Date() >= attempt.endsAt;

  const { correct, incorrect, skipped, attempted, score, accuracy } = calculateAttemptScore(
    attempt.attemptQuestions.map((aq) => ({
      selectedLabel: aq.answer?.selectedOptionLabel ?? null,
      correctLabel: aq.correctAnswerSnapshot,
    })),
    attempt.mockTest.marksPerCorrect,
    attempt.mockTest.negativeMarksPerIncorrect
  );

  // Persist per-question correctness for the results review screen.
  for (const aq of attempt.attemptQuestions) {
    const selected = aq.answer?.selectedOptionLabel ?? null;
    if (selected == null || !aq.answer) continue;
    await prisma.attemptAnswer.update({
      where: { attemptQuestionId: aq.id },
      data: { isCorrect: selected === aq.correctAnswerSnapshot },
    });
  }

  const now = new Date();
  const totalTimeSeconds = Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000);

  await prisma.testAttempt.update({
    where: { id: attemptId },
    data: {
      status: isExpired ? "auto_submitted" : "submitted",
      submittedAt: now,
      score,
      correctCount: correct,
      incorrectCount: incorrect,
      skippedCount: skipped,
      attemptedCount: attempted,
      accuracy,
      totalTimeSeconds,
    },
  });

  await updateTopicPerformanceForAttempt(attemptId);

  redirect(`/mock-tests/${attemptId}/result`);
}
