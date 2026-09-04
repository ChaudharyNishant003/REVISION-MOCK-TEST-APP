import { redirect } from "next/navigation";
import Link from "next/link";

import { requireUserId } from "@/lib/session";
import { getCurrentUserExam } from "@/lib/data/exam";
import { prisma } from "@/lib/prisma";
import CreateTestForm from "./create-test-form";

export default async function NewMockTestPage() {
  const userId = await requireUserId();
  const exam = await getCurrentUserExam(userId);
  if (!exam) redirect("/onboarding/exam");

  const questions = await prisma.question.findMany({
    where: { questionSet: { examId: exam.id }, approvalStatus: "approved", correctOptionId: { not: null } },
    include: { questionSet: true, topic: { include: { chapter: { include: { subject: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="test-page">
      <Link className="back-link" href="/mock-tests">
        ← Back to mock tests
      </Link>
      <section className="test-intro" style={{ maxWidth: "820px" }}>
        <div className="panel-kicker">NEW TEST</div>
        <h1 style={{ fontSize: "clamp(26px, 4vw, 38px)" }}>Create a mock test</h1>
        <p>Pick questions from your approved question bank and set the rules the attempt will run under.</p>
      </section>

      {questions.length === 0 ? (
        <section className="onboarding-card" style={{ maxWidth: "820px", margin: "20px auto 0" }}>
          <p className="empty-state">
            No approved questions yet. Upload MCQ images and approve them from{" "}
            <Link href="/question-bank/sets" style={{ color: "var(--coral)", fontWeight: 700 }}>
              Question Sets
            </Link>{" "}
            before creating a test.
          </p>
        </section>
      ) : (
        <CreateTestForm questions={questions} />
      )}
    </main>
  );
}
