import { prisma } from "@/lib/prisma";
import { reprioritizeTopic } from "@/lib/scheduler/reprioritize";

const MIN_QUESTIONS_FOR_A_VERDICT = 3;
const RECENT_WINDOW = 10;

/**
 * Recomputes each topic's performance profile from every submitted attempt (Document 04 §3-9).
 * A single bad test never rewrites a verdict outright — topics need a minimum sample size, and
 * only then are they labelled instead of "limited_data".
 */
export async function updateTopicPerformanceForAttempt(attemptId: string): Promise<void> {
  const attempt = await prisma.testAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { attemptQuestions: true },
  });

  const topicIds = [...new Set(attempt.attemptQuestions.map((aq) => aq.topicId).filter((id): id is string => !!id))];

  for (const topicId of topicIds) {
    const answersUnsorted = await prisma.attemptAnswer.findMany({
      where: {
        attemptQuestion: {
          topicId,
          testAttempt: { userId: attempt.userId, status: { in: ["submitted", "auto_submitted"] } },
        },
      },
      include: { attemptQuestion: { include: { testAttempt: true } } },
    });
    const answers = answersUnsorted.sort((a, b) => {
      const aTime = a.attemptQuestion.testAttempt.submittedAt?.getTime() ?? 0;
      const bTime = b.attemptQuestion.testAttempt.submittedAt?.getTime() ?? 0;
      return bTime - aTime;
    });

    const attempted = answers.filter((a) => a.selectedOptionLabel != null);
    const correct = attempted.filter((a) => a.isCorrect).length;
    const incorrect = attempted.length - correct;
    const skipped = answers.length - attempted.length;
    const accuracy = attempted.length > 0 ? (correct / attempted.length) * 100 : null;
    const averageTimeSeconds =
      attempted.length > 0 ? attempted.reduce((sum, a) => sum + a.timeSpentSeconds, 0) / attempted.length : null;

    const recent = attempted.slice(0, RECENT_WINDOW);
    const recentAccuracy = recent.length > 0 ? (recent.filter((a) => a.isCorrect).length / recent.length) * 100 : null;

    let attentionLevel = "limited_data";
    if (attempted.length >= MIN_QUESTIONS_FOR_A_VERDICT && accuracy != null) {
      if (accuracy < 55) attentionLevel = "high_attention";
      else if (accuracy < 75) attentionLevel = "needs_attention";
      else if (accuracy >= 85) attentionLevel = "strong";
      else attentionLevel = "stable";
    }

    let performanceTrend: string | null = null;
    if (attempted.length >= MIN_QUESTIONS_FOR_A_VERDICT * 2) {
      const olderHalf = attempted.slice(recent.length);
      const olderAccuracy = olderHalf.length > 0 ? (olderHalf.filter((a) => a.isCorrect).length / olderHalf.length) * 100 : null;
      if (recentAccuracy != null && olderAccuracy != null) {
        const delta = recentAccuracy - olderAccuracy;
        performanceTrend = delta > 8 ? "improving" : delta < -8 ? "declining" : "stable";
      }
    }

    const revisionPriorityScore = accuracy != null ? Math.max(0, 100 - accuracy) : 0;

    await prisma.topicPerformanceProfile.upsert({
      where: { topicId },
      create: {
        topicId,
        questionsAttempted: attempted.length,
        correctAnswers: correct,
        incorrectAnswers: incorrect,
        skippedAnswers: skipped,
        accuracy,
        averageTimeSeconds,
        recentAccuracy,
        performanceTrend,
        attentionLevel,
        revisionPriorityScore,
      },
      update: {
        questionsAttempted: attempted.length,
        correctAnswers: correct,
        incorrectAnswers: incorrect,
        skippedAnswers: skipped,
        accuracy,
        averageTimeSeconds,
        recentAccuracy,
        performanceTrend,
        attentionLevel,
        revisionPriorityScore,
      },
    });

    // Feed this attempt's performance back into the scheduler so tomorrow's task order
    // reflects it immediately, without moving any dates or rebuilding the plan.
    await reprioritizeTopic(topicId);
  }
}
