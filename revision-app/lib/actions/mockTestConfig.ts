"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { getCurrentUserExam, getExamOwnedByUser } from "@/lib/data/exam";
import { mockTestSchema } from "@/lib/validation";

export type FormState = { error: string } | null;

/** Builds a reusable test definition from approved questions (Document 03 §12-13). */
export async function createMockTestAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const exam = await getCurrentUserExam(userId);
  if (!exam) return { error: "Set up your exam first" };

  const parsed = mockTestSchema.safeParse({
    name: formData.get("name"),
    timeLimitMinutes: formData.get("timeLimitMinutes"),
    marksPerCorrect: formData.get("marksPerCorrect"),
    negativeMarksPerIncorrect: formData.get("negativeMarksPerIncorrect"),
    questionIds: formData.getAll("questionIds"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid test configuration" };

  // Every selected question must belong to this exam, be approved, and have a confirmed answer.
  const validQuestions = await prisma.question.findMany({
    where: {
      id: { in: parsed.data.questionIds },
      questionSet: { examId: exam.id },
      approvalStatus: "approved",
      correctOptionId: { not: null },
    },
    select: { id: true },
  });
  if (validQuestions.length !== parsed.data.questionIds.length) {
    return { error: "One or more selected questions aren't approved with a confirmed answer yet" };
  }

  const mockTest = await prisma.mockTest.create({
    data: {
      examId: exam.id,
      name: parsed.data.name,
      timeLimitMinutes: parsed.data.timeLimitMinutes,
      marksPerCorrect: parsed.data.marksPerCorrect,
      negativeMarksPerIncorrect: parsed.data.negativeMarksPerIncorrect,
      status: "ready",
      testQuestions: {
        create: parsed.data.questionIds.map((questionId, index) => ({ questionId, sortOrder: index })),
      },
    },
  });

  revalidatePath("/mock-tests");
  redirect(`/mock-tests?created=${mockTest.id}`);
}

/** Archives a test so it drops off the "ready to sit" list — past attempts and results are untouched. */
export async function archiveMockTestAction(mockTestId: string): Promise<void> {
  const userId = await requireUserId();
  const mockTest = await prisma.mockTest.findUnique({ where: { id: mockTestId } });
  if (!mockTest) return;
  const exam = await getExamOwnedByUser(mockTest.examId, userId);
  if (!exam) return;

  await prisma.mockTest.update({ where: { id: mockTestId }, data: { status: "archived" } });
  revalidatePath("/mock-tests");
}
