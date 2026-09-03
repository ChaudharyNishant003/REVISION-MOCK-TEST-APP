import { prisma } from "@/lib/prisma";

export async function getAttemptForUser(attemptId: string, userId: string) {
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      mockTest: true,
      attemptQuestions: {
        orderBy: { sortOrder: "asc" },
        include: { answer: true },
      },
    },
  });
  if (!attempt || attempt.userId !== userId) return null;
  return attempt;
}

export async function getAttemptHistory(userId: string, examId: string) {
  return prisma.testAttempt.findMany({
    where: { userId, mockTest: { examId }, status: { in: ["submitted", "auto_submitted"] } },
    orderBy: { submittedAt: "desc" },
    include: { mockTest: true },
    take: 10,
  });
}
