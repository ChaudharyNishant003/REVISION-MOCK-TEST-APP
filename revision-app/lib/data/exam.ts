import { prisma } from "@/lib/prisma";

/** V1 assumes one exam context per user (Document 05 §4), even though the schema allows more. */
export async function getCurrentUserExam(userId: string) {
  return prisma.exam.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      availability: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      subjects: {
        orderBy: { sortOrder: "asc" },
        include: {
          chapters: {
            orderBy: { sortOrder: "asc" },
            include: { topics: { orderBy: { createdAt: "asc" } } },
          },
        },
      },
    },
  });
}

export async function getExamOwnedByUser(examId: string, userId: string) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.userId !== userId) return null;
  return exam;
}
