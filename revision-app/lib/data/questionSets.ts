import { prisma } from "@/lib/prisma";
import { getExamOwnedByUser } from "@/lib/data/exam";

export async function getQuestionSetsForExam(examId: string) {
  return prisma.questionSet.findMany({
    where: { examId },
    orderBy: { createdAt: "desc" },
    include: {
      sourceImages: { select: { id: true, processingStatus: true } },
      questions: { select: { id: true, approvalStatus: true } },
    },
  });
}

export async function getQuestionSetDetail(setId: string, userId: string) {
  const set = await prisma.questionSet.findUnique({
    where: { id: setId },
    include: {
      sourceImages: { orderBy: { createdAt: "asc" } },
      questions: {
        orderBy: { createdAt: "asc" },
        include: {
          options: { orderBy: { sortOrder: "asc" } },
          topic: { include: { chapter: { include: { subject: true } } } },
          extractionMetadata: true,
        },
      },
    },
  });
  if (!set) return null;
  const exam = await getExamOwnedByUser(set.examId, userId);
  if (!exam) return null;
  return set;
}
