"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { getCurrentUserExam, getExamOwnedByUser } from "@/lib/data/exam";
import { questionSetSchema } from "@/lib/validation";
import { isAllowedImageType, isWithinSizeLimit, saveQuestionImage, readImageAsBase64 } from "@/lib/ai/storage";
import { extractQuestionsFromImage, OpenAIKeyMissingError } from "@/lib/ai/extraction";
import { getDecryptedOpenAiKey } from "@/lib/data/user";

export type FormState = { error: string } | null;

/** Creates a question set and stores every uploaded image privately (Document 07 §11, Document 08 §7). */
export async function uploadQuestionSetAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const exam = await getCurrentUserExam(userId);
  if (!exam) return { error: "Set up your exam first" };

  const parsed = questionSetSchema.safeParse({
    name: formData.get("name"),
    topicId: formData.get("topicId") || "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid question set" };

  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Add at least one image" };

  for (const file of files) {
    if (!isAllowedImageType(file.type)) return { error: `${file.name}: unsupported file type` };
    if (!isWithinSizeLimit(file.size)) return { error: `${file.name}: file is too large (12MB max)` };
  }

  const topicId = parsed.data.topicId || null;
  let topicChapter = null;
  if (topicId) {
    topicChapter = await prisma.topic.findFirst({
      where: { id: topicId, chapter: { subject: { examId: exam.id } } },
      select: { chapterId: true, chapter: { select: { subjectId: true } } },
    });
    if (!topicChapter) return { error: "Topic not found" };
  }

  const questionSet = await prisma.questionSet.create({
    data: {
      examId: exam.id,
      name: parsed.data.name,
      topicId,
      chapterId: topicChapter?.chapterId ?? null,
      subjectId: topicChapter?.chapter.subjectId ?? null,
    },
  });

  for (const file of files) {
    const { storagePath } = await saveQuestionImage(questionSet.id, file);
    await prisma.questionSourceImage.create({
      data: {
        questionSetId: questionSet.id,
        storagePath,
        originalFileName: file.name,
        mimeType: file.type,
        processingStatus: "uploaded",
      },
    });
  }

  revalidatePath("/question-bank");
  redirect(`/question-bank/sets/${questionSet.id}`);
}

async function assertImageOwnedByUser(imageId: string, userId: string) {
  const image = await prisma.questionSourceImage.findUnique({
    where: { id: imageId },
    include: { questionSet: true },
  });
  if (!image) return null;
  const exam = await getExamOwnedByUser(image.questionSet.examId, userId);
  return exam ? image : null;
}

/**
 * Runs one uploaded image through AI extraction and turns the result into draft questions
 * (Document 06 §4-9, Document 08 §7). Independent per image, so a failure on one image never
 * blocks the others — this doubles as the "retry" action for a previously failed image.
 */
export async function processImageAction(imageId: string): Promise<void> {
  const userId = await requireUserId();
  const image = await assertImageOwnedByUser(imageId, userId);
  if (!image || image.processingStatus === "processing") return;

  await prisma.questionSourceImage.update({
    where: { id: imageId },
    data: { processingStatus: "processing", errorMessage: null },
  });

  const job = await prisma.aiProcessingJob.create({
    data: {
      questionSetId: image.questionSetId,
      sourceImageId: image.id,
      jobType: "mcq_extraction",
      status: "processing",
      startedAt: new Date(),
    },
  });

  try {
    const topics = await prisma.topic.findMany({
      where: { chapter: { subject: { examId: image.questionSet.examId } } },
      select: { id: true, name: true },
    });

    const apiKey = (await getDecryptedOpenAiKey(userId)) ?? process.env.OPENAI_API_KEY ?? null;
    if (!apiKey) throw new OpenAIKeyMissingError();

    const base64 = await readImageAsBase64(image.storagePath);
    const extracted = await extractQuestionsFromImage(apiKey, base64, image.mimeType, topics.map((t) => t.name));

    for (const q of extracted) {
      const matchedTopic = q.topicSuggestion
        ? topics.find((t) => t.name.toLowerCase() === q.topicSuggestion!.toLowerCase())
        : undefined;

      const question = await prisma.question.create({
        data: {
          questionSetId: image.questionSetId,
          sourceImageId: image.id,
          topicId: matchedTopic?.id ?? null,
          questionText: q.questionText,
          approvalStatus: "needs_review",
          options: {
            create: q.options.map((o, index) => ({ label: o.label, text: o.text, sortOrder: index })),
          },
        },
        include: { options: true },
      });

      const correctOption = q.correctLabel ? question.options.find((o) => o.label === q.correctLabel) : undefined;
      if (correctOption) {
        await prisma.question.update({ where: { id: question.id }, data: { correctOptionId: correctOption.id } });
      }

      await prisma.questionExtractionMetadata.create({
        data: {
          questionId: question.id,
          aiConfidence: q.confidence,
          requiresReview: q.incomplete || !correctOption || q.confidence < 0.7,
        },
      });
    }

    await prisma.questionSourceImage.update({
      where: { id: imageId },
      data: { processingStatus: "completed", processedAt: new Date() },
    });
    await prisma.aiProcessingJob.update({
      where: { id: job.id },
      data: { status: "completed", completedAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";

    await prisma.questionSourceImage.update({
      where: { id: imageId },
      data: { processingStatus: "failed", errorMessage: message },
    });
    await prisma.aiProcessingJob.update({
      where: { id: job.id },
      data: { status: "failed", errorMessage: message, completedAt: new Date() },
    });
  }

  revalidatePath(`/question-bank/sets/${image.questionSetId}`);
}
