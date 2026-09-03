/**
 * Test-data seed script. Not wired into `prisma db seed` — run manually with:
 *   npx tsx prisma/seed.ts
 *
 * Creates one full account (owner@example.com) with a real exam, availability,
 * syllabus, a generated revision plan (some completed, some overdue), an
 * approved question bank, a mock test, and one submitted attempt — so every
 * screen in the app has real data to look at.
 */
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { addDays, startOfDay } from "@/lib/scheduler/dates";
import { generateInitialPlan } from "@/lib/scheduler/generatePlan";
import { completeRevisionTask } from "@/lib/scheduler/completeRevision";
import { updateTopicPerformanceForAttempt } from "@/lib/analytics/updateTopicPerformance";

const EMAIL = "owner@example.com";
const PASSWORD = "Password123!";

type Difficulty = "easy" | "medium" | "hard";
type Importance = "low" | "medium" | "high";

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log(`Removing existing ${EMAIL} account so the seed is repeatable...`);
    await prisma.user.delete({ where: { id: existing.id } }); // cascades to everything owned by this user
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: { name: "Owner", email: EMAIL, passwordHash },
  });

  const examDate = addDays(startOfDay(new Date()), 90);
  const exam = await prisma.exam.create({
    data: { userId: user.id, name: "Uttarakhand Accountant Examination", examDate },
  });

  // Weekly availability: weekday evenings + a longer weekend block.
  await prisma.studyAvailability.createMany({
    data: [
      { examId: exam.id, dayOfWeek: 1, startTime: "19:00", endTime: "21:30" }, // Mon
      { examId: exam.id, dayOfWeek: 2, startTime: "19:00", endTime: "21:00" }, // Tue
      { examId: exam.id, dayOfWeek: 3, startTime: "19:00", endTime: "21:30" }, // Wed
      { examId: exam.id, dayOfWeek: 4, startTime: "19:00", endTime: "21:00" }, // Thu
      { examId: exam.id, dayOfWeek: 5, startTime: "18:00", endTime: "20:00" }, // Fri
      { examId: exam.id, dayOfWeek: 6, startTime: "09:00", endTime: "13:00" }, // Sat
      { examId: exam.id, dayOfWeek: 0, startTime: "09:00", endTime: "12:00" }, // Sun
    ],
  });

  // ---- Syllabus: Subject -> Chapter -> Topic ----
  type TopicSeed = { name: string; minutes: number; difficulty: Difficulty; importance: Importance };
  const syllabus: { subject: string; chapters: { chapter: string; topics: TopicSeed[] }[] }[] = [
    {
      subject: "Financial Accounting",
      chapters: [
        {
          chapter: "Depreciation & Fixed Assets",
          topics: [
            { name: "Straight-Line vs WDV Depreciation", minutes: 30, difficulty: "medium", importance: "high" },
            { name: "Disposal of Fixed Assets", minutes: 25, difficulty: "easy", importance: "medium" },
          ],
        },
        {
          chapter: "Inventory Valuation",
          topics: [
            { name: "FIFO vs Weighted Average", minutes: 35, difficulty: "medium", importance: "high" },
            { name: "Net Realisable Value Adjustments", minutes: 30, difficulty: "hard", importance: "medium" },
          ],
        },
      ],
    },
    {
      subject: "Cost & Management Accounting",
      chapters: [
        {
          chapter: "Standard Costing",
          topics: [
            { name: "Material & Labour Variances", minutes: 45, difficulty: "hard", importance: "high" },
            { name: "Overhead Variance Analysis", minutes: 40, difficulty: "hard", importance: "medium" },
          ],
        },
        {
          chapter: "Marginal Costing",
          topics: [{ name: "Break-Even Analysis", minutes: 30, difficulty: "medium", importance: "medium" }],
        },
      ],
    },
    {
      subject: "Taxation",
      chapters: [
        {
          chapter: "Income Tax Basics",
          topics: [
            { name: "Heads of Income", minutes: 30, difficulty: "medium", importance: "high" },
            { name: "Deductions under Chapter VI-A", minutes: 35, difficulty: "medium", importance: "high" },
          ],
        },
        {
          chapter: "GST Fundamentals",
          topics: [{ name: "Input Tax Credit Rules", minutes: 40, difficulty: "hard", importance: "high" }],
        },
      ],
    },
    {
      subject: "Corporate Law",
      chapters: [
        {
          chapter: "Company Formation",
          topics: [{ name: "Types of Companies & MOA/AOA", minutes: 25, difficulty: "easy", importance: "low" }],
        },
      ],
    },
  ];

  const topicIdByName = new Map<string, string>();
  for (const [sIndex, s] of syllabus.entries()) {
    const subject = await prisma.subject.create({ data: { examId: exam.id, name: s.subject, sortOrder: sIndex } });
    for (const [cIndex, c] of s.chapters.entries()) {
      const chapter = await prisma.chapter.create({ data: { subjectId: subject.id, name: c.chapter, sortOrder: cIndex } });
      for (const t of c.topics) {
        const topic = await prisma.topic.create({
          data: {
            chapterId: chapter.id,
            name: t.name,
            estimatedRevisionMinutes: t.minutes,
            difficulty: t.difficulty,
            importance: t.importance,
          },
        });
        topicIdByName.set(t.name, topic.id);
      }
    }
  }

  // ---- Generate the first revision pass for every topic ----
  const planResult = await generateInitialPlan(exam.id);
  console.log(`Generated plan: ${planResult.scheduled} scheduled, ${planResult.unscheduled} unscheduled.`);

  // Complete a few tasks with different confidence ratings, to populate history + progress.
  async function completeTopic(topicName: string, confidence: "strong" | "okay" | "weak") {
    const topicId = topicIdByName.get(topicName)!;
    const task = await prisma.revisionTask.findFirst({ where: { topicId, status: "scheduled" } });
    if (task) await completeRevisionTask(task.id, confidence);
  }
  await completeTopic("Disposal of Fixed Assets", "strong");
  await completeTopic("Heads of Income", "okay");
  await completeTopic("Types of Companies & MOA/AOA", "weak");

  // Backdate two still-scheduled tasks so the app's own overdue check flips them live.
  async function makeOverdue(topicName: string, daysAgo: number) {
    const topicId = topicIdByName.get(topicName)!;
    const task = await prisma.revisionTask.findFirst({ where: { topicId, status: "scheduled" } });
    if (task) {
      await prisma.revisionTask.update({
        where: { id: task.id },
        data: { scheduledDate: startOfDay(addDays(new Date(), -daysAgo)) },
      });
    }
  }
  await makeOverdue("Net Realisable Value Adjustments", 3);
  await makeOverdue("Overhead Variance Analysis", 2);

  // ---- Question bank: MCQs for six topics, tagged so mock-test scoring rolls up correctly ----
  const questionSet = await prisma.questionSet.create({
    data: { examId: exam.id, name: "Practice MCQs — Set 1" },
  });

  type MCQSeed = { text: string; options: string[]; correctIndex: number; topicName: string };
  const questions: MCQSeed[] = [
    // Material & Labour Variances (4) — will score 1/4 correct
    { topicName: "Material & Labour Variances", correctIndex: 1, text: "A favourable material price variance means the actual price paid was:", options: ["Higher than standard", "Lower than standard", "Equal to standard", "Cannot be determined"] },
    { topicName: "Material & Labour Variances", correctIndex: 1, text: "Labour rate variance is calculated as:", options: ["(Standard Hours − Actual Hours) × Standard Rate", "(Standard Rate − Actual Rate) × Actual Hours", "(Actual Rate − Standard Rate) × Standard Hours", "(Actual Hours − Standard Hours) × Actual Rate"] },
    { topicName: "Material & Labour Variances", correctIndex: 1, text: "An adverse labour efficiency variance indicates that:", options: ["Workers took less time than standard", "Workers took more time than standard", "Wage rates increased", "Material was wasted"] },
    { topicName: "Material & Labour Variances", correctIndex: 1, text: "Total material cost variance is the sum of:", options: ["Price variance and mix variance", "Price variance and usage variance", "Usage variance and yield variance", "Mix variance and yield variance"] },

    // Input Tax Credit Rules (4) — will score 2/4 correct
    { topicName: "Input Tax Credit Rules", correctIndex: 1, text: "Input Tax Credit (ITC) cannot generally be claimed on:", options: ["Raw materials used in production", "Motor vehicles for personal use", "Capital goods used in business", "Input services used for taxable supply"] },
    { topicName: "Input Tax Credit Rules", correctIndex: 1, text: "To claim ITC, the recipient must:", options: ["Pay in cash only", "Possess a valid tax invoice and have received the goods/services", "Wait 180 days regardless", "File only the annual return"] },
    { topicName: "Input Tax Credit Rules", correctIndex: 2, text: "ITC on goods used partly for business and partly for personal use is:", options: ["Fully allowed", "Fully disallowed", "Allowed only to the extent used for business", "Allowed only with special approval"] },
    { topicName: "Input Tax Credit Rules", correctIndex: 1, text: "If payment to the supplier is not made within 180 days, the recipient must:", options: ["Ignore the ITC already claimed", "Reverse the ITC claimed, with interest", "Claim additional ITC", "Report it as a bad debt only"] },

    // FIFO vs Weighted Average (4) — will score 3/4 correct
    { topicName: "FIFO vs Weighted Average", correctIndex: 1, text: "Under FIFO, closing inventory is valued closest to:", options: ["The earliest purchase prices", "The most recent purchase prices", "A blended average price", "Standard cost"] },
    { topicName: "FIFO vs Weighted Average", correctIndex: 1, text: "In a period of rising prices, FIFO generally results in:", options: ["Lower closing inventory value", "Higher closing inventory value and higher profit", "No difference from weighted average", "Lower profit"] },
    { topicName: "FIFO vs Weighted Average", correctIndex: 1, text: "Under the weighted average method, the cost per unit is recalculated:", options: ["Only at year-end", "After every purchase", "Only at the start of the year", "Never"] },
    { topicName: "FIFO vs Weighted Average", correctIndex: 2, text: "Which method assumes the oldest stock is issued first?", options: ["LIFO", "Weighted average", "FIFO", "Specific identification"] },

    // Straight-Line vs WDV Depreciation (4) — will score 4/4 correct
    { topicName: "Straight-Line vs WDV Depreciation", correctIndex: 1, text: "Under the straight-line method, annual depreciation is:", options: ["A fixed percentage of book value each year", "The same amount every year", "Higher in early years, lower later", "Based on units produced"] },
    { topicName: "Straight-Line vs WDV Depreciation", correctIndex: 1, text: "Under the written-down value (WDV) method, depreciation is charged on:", options: ["Original cost every year", "The asset's book value at the start of the year", "Salvage value", "A random rate each year"] },
    { topicName: "Straight-Line vs WDV Depreciation", correctIndex: 1, text: "Compared to WDV, the straight-line method charges depreciation that is:", options: ["Higher in later years", "Constant every year, unlike WDV's declining charge", "Zero in the first year", "Always higher overall"] },
    { topicName: "Straight-Line vs WDV Depreciation", correctIndex: 2, text: "Under WDV, the depreciation charge over an asset's life:", options: ["Stays constant", "Increases each year", "Decreases each year", "Is charged only in the final year"] },

    // Deductions under Chapter VI-A (3) — will score 2/3 correct
    { topicName: "Deductions under Chapter VI-A", correctIndex: 1, text: "Deduction under Section 80C is available for:", options: ["Rent paid by an employee", "Life insurance premium and specified investments", "Medical insurance premium only", "Donations only"] },
    { topicName: "Deductions under Chapter VI-A", correctIndex: 1, text: "Deduction for medical insurance premium is claimed under:", options: ["Section 80C", "Section 80D", "Section 80G", "Section 80E"] },
    { topicName: "Deductions under Chapter VI-A", correctIndex: 1, text: "The maximum aggregate deduction generally allowed under Section 80C is:", options: ["Unlimited", "₹1,50,000", "₹50,000", "₹2,00,000"] },

    // Break-Even Analysis (2) — left unanswered in the seeded attempt
    { topicName: "Break-Even Analysis", correctIndex: 1, text: "At the break-even point, total contribution equals:", options: ["Total variable cost", "Total fixed cost", "Total sales", "Zero"] },
    { topicName: "Break-Even Analysis", correctIndex: 1, text: "Margin of safety is the difference between:", options: ["Fixed cost and variable cost", "Actual sales and break-even sales", "Selling price and variable cost per unit", "Budgeted profit and actual profit"] },
  ];

  const optionLabels = ["A", "B", "C", "D"];
  const createdQuestionIds: string[] = [];
  const optionLabelByQuestionId = new Map<string, string>(); // the label the seeded attempt will select

  for (const q of questions) {
    const question = await prisma.question.create({
      data: {
        questionSetId: questionSet.id,
        topicId: topicIdByName.get(q.topicName)!,
        questionText: q.text,
        approvalStatus: "approved",
      },
    });
    let correctOptionId = "";
    for (const [i, text] of q.options.entries()) {
      const opt = await prisma.questionOption.create({
        data: { questionId: question.id, label: optionLabels[i], text, sortOrder: i },
      });
      if (i === q.correctIndex) correctOptionId = opt.id;
    }
    await prisma.question.update({ where: { id: question.id }, data: { correctOptionId } });
    createdQuestionIds.push(question.id);
  }

  // ---- Mock test made up of all the questions above ----
  const mockTest = await prisma.mockTest.create({
    data: {
      examId: exam.id,
      name: "Mock Test 1 — Full Syllabus",
      timeLimitMinutes: 30,
      marksPerCorrect: 2,
      negativeMarksPerIncorrect: 0.5,
      status: "ready",
    },
  });
  for (const [i, questionId] of createdQuestionIds.entries()) {
    await prisma.mockTestQuestion.create({ data: { mockTestId: mockTest.id, questionId, sortOrder: i } });
  }

  // ---- One submitted attempt: mixed right/wrong/skipped answers per the plan above ----
  const startedAt = new Date(Date.now() - 25 * 60_000);
  const submittedAt = new Date(Date.now() - 3 * 60_000);
  const endsAt = new Date(startedAt.getTime() + mockTest.timeLimitMinutes * 60_000);

  const attempt = await prisma.testAttempt.create({
    data: { mockTestId: mockTest.id, userId: user.id, startedAt, endsAt, status: "in_progress" },
  });

  // How many of each topic's questions to answer correctly (in question order); the rest are wrong, except
  // Break-Even Analysis which is left fully unanswered.
  const correctCountByTopic: Record<string, number> = {
    "Material & Labour Variances": 1,
    "Input Tax Credit Rules": 2,
    "FIFO vs Weighted Average": 3,
    "Straight-Line vs WDV Depreciation": 4,
    "Deductions under Chapter VI-A": 2,
  };
  const seenPerTopic = new Map<string, number>();

  let correct = 0;
  let incorrect = 0;
  let skipped = 0;

  for (const [i, questionId] of createdQuestionIds.entries()) {
    const q = questions[i];
    const question = await prisma.question.findUniqueOrThrow({ where: { id: questionId }, include: { options: { orderBy: { sortOrder: "asc" } } } });
    const correctOption = question.options.find((o) => o.id === question.correctOptionId)!;

    const attemptQuestion = await prisma.attemptQuestion.create({
      data: {
        testAttemptId: attempt.id,
        originalQuestionId: question.id,
        topicId: question.topicId,
        questionTextSnapshot: question.questionText,
        optionsSnapshot: JSON.stringify(question.options.map((o) => ({ label: o.label, text: o.text }))),
        correctAnswerSnapshot: correctOption.label,
        sortOrder: i,
      },
    });

    if (q.topicName === "Break-Even Analysis") {
      await prisma.attemptAnswer.create({ data: { attemptQuestionId: attemptQuestion.id, answerStatus: "not_visited" } });
      skipped++;
      continue;
    }

    const seenSoFar = seenPerTopic.get(q.topicName) ?? 0;
    const shouldBeCorrect = seenSoFar < correctCountByTopic[q.topicName];
    seenPerTopic.set(q.topicName, seenSoFar + 1);

    const selectedOption = shouldBeCorrect
      ? correctOption
      : question.options.find((o) => o.id !== correctOption.id)!;
    const isCorrect = selectedOption.id === correctOption.id;

    await prisma.attemptAnswer.create({
      data: {
        attemptQuestionId: attemptQuestion.id,
        selectedOptionLabel: selectedOption.label,
        answerStatus: "answered",
        isMarkedForReview: false,
        firstAnsweredAt: startedAt,
        lastAnsweredAt: startedAt,
        isCorrect,
      },
    });
    if (isCorrect) correct++;
    else incorrect++;
  }

  const attempted = correct + incorrect;
  const score = correct * mockTest.marksPerCorrect - incorrect * mockTest.negativeMarksPerIncorrect;
  const accuracy = attempted > 0 ? (correct / attempted) * 100 : 0;
  const totalTimeSeconds = Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000);

  await prisma.testAttempt.update({
    where: { id: attempt.id },
    data: {
      status: "submitted",
      submittedAt,
      score,
      correctCount: correct,
      incorrectCount: incorrect,
      skippedCount: skipped,
      attemptedCount: attempted,
      accuracy,
      totalTimeSeconds,
    },
  });

  await updateTopicPerformanceForAttempt(attempt.id);

  console.log("\nSeed complete.");
  console.log(`  Login email:    ${EMAIL}`);
  console.log(`  Login password: ${PASSWORD}`);
  console.log(`  Exam:           ${exam.name} (${exam.examDate.toDateString()})`);
  console.log(`  Mock attempt:   ${correct} correct, ${incorrect} incorrect, ${skipped} skipped — score ${score}, accuracy ${accuracy.toFixed(1)}%`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
