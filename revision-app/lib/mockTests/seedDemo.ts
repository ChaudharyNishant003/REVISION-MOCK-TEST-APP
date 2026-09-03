import { prisma } from "@/lib/prisma";

const DEMO_QUESTIONS = [
  {
    text: "Which account is prepared to find gross profit or gross loss?",
    options: ["Trading Account", "Balance Sheet", "Cash Book", "Trial Balance"],
    correctIndex: 0,
  },
  {
    text: "Under the straight-line method, depreciation is calculated on:",
    options: ["Market value", "Original cost", "Scrap value only", "Book profit"],
    correctIndex: 1,
  },
  {
    text: "A trial balance is primarily prepared to check the:",
    options: [
      "Profitability of a business",
      "Financial position",
      "Arithmetical accuracy of ledger posting",
      "Cash position",
    ],
    correctIndex: 2,
  },
] as const;

/**
 * Creates one small approved question set + ready mock test the first time a user reaches
 * their dashboard, so the mock-test loop is real and usable before the OpenAI upload pipeline
 * (Document 03/06) is wired in. No-ops if the exam already has a mock test.
 */
export async function ensureDemoMockTest(examId: string): Promise<void> {
  const existing = await prisma.mockTest.findFirst({ where: { examId } });
  if (existing) return;

  const questionSet = await prisma.questionSet.create({
    data: { examId, name: "Accounting Fundamentals — Sample Set" },
  });

  const mockTest = await prisma.mockTest.create({
    data: {
      examId,
      name: "Accounting Fundamentals",
      timeLimitMinutes: 6,
      marksPerCorrect: 1,
      negativeMarksPerIncorrect: 0.25,
      status: "ready",
    },
  });

  for (let i = 0; i < DEMO_QUESTIONS.length; i++) {
    const q = DEMO_QUESTIONS[i];
    const question = await prisma.question.create({
      data: {
        questionSetId: questionSet.id,
        questionText: q.text,
        approvalStatus: "approved",
        options: {
          create: q.options.map((text, idx) => ({
            label: String.fromCharCode(65 + idx),
            text,
            sortOrder: idx,
          })),
        },
      },
      include: { options: true },
    });

    const correctOption = question.options[q.correctIndex];
    await prisma.question.update({
      where: { id: question.id },
      data: { correctOptionId: correctOption.id },
    });

    await prisma.mockTestQuestion.create({
      data: { mockTestId: mockTest.id, questionId: question.id, sortOrder: i },
    });
  }
}
