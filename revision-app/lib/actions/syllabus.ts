"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { chapterSchema, subjectSchema, topicSchema } from "@/lib/validation";
import { getCurrentUserExam, getExamOwnedByUser } from "@/lib/data/exam";
import { generateInitialPlan, scheduleTopicIntoPlan } from "@/lib/scheduler/generatePlan";
import { ensureDemoMockTest } from "@/lib/mockTests/seedDemo";

export type FormState = { error: string } | null;

async function assertSubjectOwnedByUser(subjectId: string, userId: string) {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) return null;
  const exam = await getExamOwnedByUser(subject.examId, userId);
  return exam ? subject : null;
}

async function assertChapterOwnedByUser(chapterId: string, userId: string) {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: { subject: true },
  });
  if (!chapter) return null;
  const exam = await getExamOwnedByUser(chapter.subject.examId, userId);
  return exam ? chapter : null;
}

async function assertTopicOwnedByUser(topicId: string, userId: string) {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { chapter: { include: { subject: true } } },
  });
  if (!topic) return null;
  const exam = await getExamOwnedByUser(topic.chapter.subject.examId, userId);
  return exam ? topic : null;
}

export async function createSubjectAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const exam = await getCurrentUserExam(userId);
  if (!exam) return { error: "Set up your exam first" };

  const parsed = subjectSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name" };

  const sortOrder = await prisma.subject.count({ where: { examId: exam.id } });
  await prisma.subject.create({ data: { examId: exam.id, name: parsed.data.name, sortOrder } });

  revalidatePath("/onboarding/syllabus");
  revalidatePath("/revision");
  return null;
}

export async function updateSubjectAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const subjectId = String(formData.get("subjectId"));
  const subject = await assertSubjectOwnedByUser(subjectId, userId);
  if (!subject) return { error: "Subject not found" };

  const parsed = subjectSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name" };

  await prisma.subject.update({ where: { id: subjectId }, data: { name: parsed.data.name } });

  revalidatePath("/onboarding/syllabus");
  revalidatePath("/revision");
  return null;
}

/** Cascades to every chapter/topic/revision task under this subject (Document 05 §7). */
export async function deleteSubjectAction(subjectId: string): Promise<void> {
  const userId = await requireUserId();
  const subject = await assertSubjectOwnedByUser(subjectId, userId);
  if (!subject) return;

  await prisma.subject.delete({ where: { id: subjectId } });
  revalidatePath("/onboarding/syllabus");
  revalidatePath("/revision");
  revalidatePath("/");
}

export async function createChapterAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const subjectId = String(formData.get("subjectId"));
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) return { error: "Subject not found" };
  const exam = await getExamOwnedByUser(subject.examId, userId);
  if (!exam) return { error: "Subject not found" };

  const parsed = chapterSchema.safeParse({ subjectId, name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name" };

  const sortOrder = await prisma.chapter.count({ where: { subjectId } });
  await prisma.chapter.create({ data: { subjectId, name: parsed.data.name, sortOrder } });

  revalidatePath("/onboarding/syllabus");
  revalidatePath("/revision");
  return null;
}

export async function updateChapterAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const chapterId = String(formData.get("chapterId"));
  const chapter = await assertChapterOwnedByUser(chapterId, userId);
  if (!chapter) return { error: "Chapter not found" };

  const parsed = chapterSchema.safeParse({ subjectId: chapter.subjectId, name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name" };

  await prisma.chapter.update({ where: { id: chapterId }, data: { name: parsed.data.name } });

  revalidatePath("/onboarding/syllabus");
  revalidatePath("/revision");
  return null;
}

/** Cascades to every topic/revision task under this chapter (Document 05 §7). */
export async function deleteChapterAction(chapterId: string): Promise<void> {
  const userId = await requireUserId();
  const chapter = await assertChapterOwnedByUser(chapterId, userId);
  if (!chapter) return;

  await prisma.chapter.delete({ where: { id: chapterId } });
  revalidatePath("/onboarding/syllabus");
  revalidatePath("/revision");
  revalidatePath("/");
}

export async function createTopicAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const chapterId = String(formData.get("chapterId"));
  const chapter = await assertChapterOwnedByUser(chapterId, userId);
  if (!chapter) return { error: "Chapter not found" };

  const parsed = topicSchema.safeParse({
    chapterId,
    name: formData.get("name"),
    estimatedRevisionMinutes: formData.get("estimatedRevisionMinutes") || 30,
    difficulty: formData.get("difficulty") || "medium",
    importance: formData.get("importance") || "medium",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid topic" };

  const topic = await prisma.topic.create({
    data: {
      chapterId,
      name: parsed.data.name,
      estimatedRevisionMinutes: parsed.data.estimatedRevisionMinutes,
      difficulty: parsed.data.difficulty,
      importance: parsed.data.importance,
    },
  });

  // If a plan already exists (topic added after onboarding), slot it in immediately (Document 02 §15).
  const existingPlanCount = await prisma.revisionTask.count({ where: { exam: { userId } } });
  if (existingPlanCount > 0) {
    await scheduleTopicIntoPlan(chapter.subject.examId, topic.id);
  }

  revalidatePath("/onboarding/syllabus");
  revalidatePath("/revision");
  revalidatePath("/");
  return null;
}

export async function updateTopicAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const topicId = String(formData.get("topicId"));
  const topic = await assertTopicOwnedByUser(topicId, userId);
  if (!topic) return { error: "Topic not found" };

  const parsed = topicSchema.safeParse({
    chapterId: topic.chapterId,
    name: formData.get("name"),
    estimatedRevisionMinutes: formData.get("estimatedRevisionMinutes") || 30,
    difficulty: formData.get("difficulty") || "medium",
    importance: formData.get("importance") || "medium",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid topic" };

  await prisma.topic.update({
    where: { id: topicId },
    data: {
      name: parsed.data.name,
      estimatedRevisionMinutes: parsed.data.estimatedRevisionMinutes,
      difficulty: parsed.data.difficulty,
      importance: parsed.data.importance,
    },
  });

  revalidatePath("/onboarding/syllabus");
  revalidatePath("/revision");
  return null;
}

export async function deleteTopicAction(topicId: string): Promise<void> {
  const userId = await requireUserId();
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { chapter: { include: { subject: true } } },
  });
  if (!topic) return;
  const exam = await getExamOwnedByUser(topic.chapter.subject.examId, userId);
  if (!exam) return;

  await prisma.topic.delete({ where: { id: topicId } });
  revalidatePath("/onboarding/syllabus");
  revalidatePath("/revision");
  revalidatePath("/");
}

export async function generatePlanAndFinishAction(): Promise<void> {
  const userId = await requireUserId();
  const exam = await getCurrentUserExam(userId);
  if (!exam) redirect("/onboarding/exam");

  await generateInitialPlan(exam!.id);
  await ensureDemoMockTest(exam!.id);
  redirect("/");
}
