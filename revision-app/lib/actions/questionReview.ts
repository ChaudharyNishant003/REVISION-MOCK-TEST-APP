"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { getExamOwnedByUser } from "@/lib/data/exam";
import { draftQuestionSchema } from "@/lib/validation";

export type FormState = { error: string } | null;

async function assertQuestionOwnedByUser(questionId: string, userId: string) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { questionSet: true, options: true },
  });
  if (!question) return null;
  const exam = await getExamOwnedByUser(question.questionSet.examId, userId);
  return exam ? question : null;
}

/**
 * Saves any edits and moves a question into the active bank (Document 03 §14, Document 09 §13).
 * Only approved questions with a confirmed answer can ever be used in a scored mock test.
 */
export async function approveQuestionAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const questionId = String(formData.get("questionId"));
  const question = await assertQuestionOwnedByUser(questionId, userId);
  if (!question) return { error: "Question not found" };

  const optionIds = formData.getAll("optionId").map(String);
  const optionLabels = formData.getAll("optionLabel").map(String);
  const optionTexts = formData.getAll("optionText").map(String);
  const options = optionIds.map((id, i) => ({ id, label: optionLabels[i], text: optionTexts[i] }));

  const parsed = draftQuestionSchema.safeParse({
    questionId,
    questionText: formData.get("questionText"),
    topicId: formData.get("topicId") || "",
    correctLabel: formData.get("correctLabel"),
    options,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the question fields" };

  const validOptionIds = new Set(question.options.map((o) => o.id));
  if (!parsed.data.options.every((o) => o.id && validOptionIds.has(o.id))) {
    return { error: "Options don't match this question" };
  }

  const correctOption = parsed.data.options.find((o) => o.label === parsed.data.correctLabel);
  if (!correctOption) return { error: "Select the correct option" };

  await prisma.$transaction([
    ...parsed.data.options.map((o) =>
      prisma.questionOption.update({ where: { id: o.id }, data: { text: o.text } })
    ),
    prisma.question.update({
      where: { id: questionId },
      data: {
        questionText: parsed.data.questionText,
        topicId: parsed.data.topicId || null,
        correctOptionId: correctOption.id,
        approvalStatus: "approved",
      },
    }),
  ]);

  revalidatePath(`/question-bank/sets/${question.questionSetId}`);
  revalidatePath("/question-bank");
  return null;
}

/** Archives a draft question — it stays in history but never appears in the active bank (Document 09 §13). */
export async function rejectQuestionAction(questionId: string): Promise<void> {
  const userId = await requireUserId();
  const question = await assertQuestionOwnedByUser(questionId, userId);
  if (!question) return;

  await prisma.question.update({ where: { id: questionId }, data: { approvalStatus: "rejected" } });

  revalidatePath(`/question-bank/sets/${question.questionSetId}`);
  revalidatePath("/question-bank");
}
