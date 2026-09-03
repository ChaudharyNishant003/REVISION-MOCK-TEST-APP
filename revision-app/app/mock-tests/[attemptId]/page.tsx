import { redirect, notFound } from "next/navigation";

import { requireUserId } from "@/lib/session";
import { getAttemptForUser } from "@/lib/data/mockTestAttempt";
import TestRunner from "./test-runner";

export default async function AttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const userId = await requireUserId();
  const attempt = await getAttemptForUser(attemptId, userId);

  if (!attempt) notFound();
  if (attempt.status !== "in_progress") {
    redirect(`/mock-tests/${attemptId}/result`);
  }

  const questions = attempt.attemptQuestions.map((aq) => ({
    id: aq.id,
    questionText: aq.questionTextSnapshot,
    options: JSON.parse(aq.optionsSnapshot) as { label: string; text: string }[],
    selectedOptionLabel: aq.answer?.selectedOptionLabel ?? null,
    isMarkedForReview: aq.answer?.isMarkedForReview ?? false,
  }));

  return (
    <TestRunner
      attemptId={attempt.id}
      testName={attempt.mockTest.name}
      endsAt={attempt.endsAt.toISOString()}
      questions={questions}
    />
  );
}
