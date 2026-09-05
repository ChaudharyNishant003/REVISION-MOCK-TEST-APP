/**
 * Deterministic fixture for the E2E suite. Known credentials, known data — so specs assert
 * against exact expected values instead of "something non-empty appeared."
 */
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { addDays, startOfDay } from "@/lib/scheduler/dates";
import { generateInitialPlan } from "@/lib/scheduler/generatePlan";

export const E2E_USER = { email: "e2e@test.local", password: "E2ETestPass123!", name: "E2E Tester" };
export const E2E_EXAM_NAME = "Uttarakhand Accountant Examination";

async function main() {
  const passwordHash = await bcrypt.hash(E2E_USER.password, 4); // low cost — this is a throwaway fixture
  const user = await prisma.user.create({ data: { name: E2E_USER.name, email: E2E_USER.email, passwordHash } });

  const examDate = addDays(startOfDay(new Date()), 60);
  const exam = await prisma.exam.create({ data: { userId: user.id, name: E2E_EXAM_NAME, examDate } });

  await prisma.studyAvailability.createMany({
    data: [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => ({ examId: exam.id, dayOfWeek, startTime: "19:00", endTime: "21:00" })),
  });

  const subjectA = await prisma.subject.create({ data: { examId: exam.id, name: "Financial Accounting", sortOrder: 0 } });
  const chapterA = await prisma.chapter.create({ data: { subjectId: subjectA.id, name: "Depreciation", sortOrder: 0 } });
  const topicA1 = await prisma.topic.create({
    data: { chapterId: chapterA.id, name: "Straight Line Method", estimatedRevisionMinutes: 30, difficulty: "medium", importance: "high" },
  });
  const topicA2 = await prisma.topic.create({
    data: { chapterId: chapterA.id, name: "Written Down Value", estimatedRevisionMinutes: 30, difficulty: "medium", importance: "medium" },
  });

  const subjectB = await prisma.subject.create({ data: { examId: exam.id, name: "Taxation", sortOrder: 1 } });
  const chapterB = await prisma.chapter.create({ data: { subjectId: subjectB.id, name: "GST Fundamentals", sortOrder: 0 } });
  const topicB1 = await prisma.topic.create({
    data: { chapterId: chapterB.id, name: "Input Tax Credit", estimatedRevisionMinutes: 40, difficulty: "hard", importance: "high" },
  });

  await generateInitialPlan(exam.id);

  const questionSet = await prisma.questionSet.create({ data: { examId: exam.id, name: "E2E Practice Set" } });

  const questionSpecs = [
    { text: "Which account shows gross profit or loss?", topicId: topicA1.id, options: ["Trading Account", "Balance Sheet", "Cash Book", "Trial Balance"], correctIndex: 0 },
    { text: "Under the straight-line method, depreciation is calculated on:", topicId: topicA1.id, options: ["Market value", "Original cost", "Scrap value only", "Book profit"], correctIndex: 1 },
    { text: "Under WDV, depreciation is charged on:", topicId: topicA2.id, options: ["Original cost every year", "Opening book value", "Salvage value", "A random rate"], correctIndex: 1 },
    { text: "Input Tax Credit cannot generally be claimed on:", topicId: topicB1.id, options: ["Raw materials for production", "Motor vehicles for personal use", "Capital goods for business", "Input services for taxable supply"], correctIndex: 1 },
    { text: "A trial balance is primarily prepared to check the:", topicId: topicA1.id, options: ["Profitability", "Financial position", "Arithmetical accuracy of ledger posting", "Cash position"], correctIndex: 2 },
  ];

  const questionIds: string[] = [];
  for (const spec of questionSpecs) {
    const question = await prisma.question.create({
      data: {
        questionSetId: questionSet.id,
        topicId: spec.topicId,
        questionText: spec.text,
        approvalStatus: "approved",
        options: { create: spec.options.map((text, i) => ({ label: String.fromCharCode(65 + i), text, sortOrder: i })) },
      },
      include: { options: true },
    });
    await prisma.question.update({
      where: { id: question.id },
      data: { correctOptionId: question.options[spec.correctIndex].id },
    });
    questionIds.push(question.id);
  }

  // One draft question, as if AI extraction had just produced it, so the review
  // screen (approve/reject) has something real to exercise in the browser.
  const draftSource = await prisma.questionSourceImage.create({
    data: {
      questionSetId: questionSet.id,
      storagePath: "e2e/fixture-not-a-real-file.jpg",
      originalFileName: "syllabus-page-3.jpg",
      mimeType: "image/jpeg",
      processingStatus: "completed",
      processedAt: new Date(),
    },
  });
  const draftQuestion = await prisma.question.create({
    data: {
      questionSetId: questionSet.id,
      sourceImageId: draftSource.id,
      questionText: "Margin of safety is the difference between:",
      approvalStatus: "needs_review",
      options: {
        create: [
          { label: "A", text: "Fixed cost and variable cost", sortOrder: 0 },
          { label: "B", text: "Actual sales and break-even sales", sortOrder: 1 },
          { label: "C", text: "Selling price and variable cost per unit", sortOrder: 2 },
        ],
      },
    },
    include: { options: true },
  });
  await prisma.question.update({
    where: { id: draftQuestion.id },
    data: { correctOptionId: draftQuestion.options[1].id },
  });
  await prisma.questionExtractionMetadata.create({
    data: { questionId: draftQuestion.id, aiConfidence: 0.88, requiresReview: false },
  });

  await prisma.mockTest.create({
    data: {
      examId: exam.id,
      name: "E2E Mock Test",
      timeLimitMinutes: 10,
      marksPerCorrect: 2,
      negativeMarksPerIncorrect: 0.5,
      status: "ready",
      testQuestions: { create: questionIds.map((questionId, sortOrder) => ({ questionId, sortOrder })) },
    },
  });

  console.log(`E2E fixture ready: ${E2E_USER.email} / ${E2E_USER.password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
