import { redirect } from "next/navigation";
import Link from "next/link";

import { requireUserId } from "@/lib/session";
import { getCurrentUserExam } from "@/lib/data/exam";
import { prisma } from "@/lib/prisma";
import { getAttemptHistory } from "@/lib/data/mockTestAttempt";
import StartTestButton from "./start-test-button";

export default async function MockTestsPage() {
  const userId = await requireUserId();
  const exam = await getCurrentUserExam(userId);
  if (!exam) redirect("/onboarding/exam");

  const [mockTest, history] = await Promise.all([
    prisma.mockTest.findFirst({
      where: { examId: exam.id },
      include: { testQuestions: true },
      orderBy: { createdAt: "asc" },
    }),
    getAttemptHistory(userId, exam.id),
  ]);

  if (!mockTest) {
    return (
      <main className="test-page">
        <Link className="back-link" href="/">
          ← Back to dashboard
        </Link>
        <section className="test-intro">
          <div className="panel-kicker">MOCK TESTS</div>
          <h1>No tests yet</h1>
          <p>Upload MCQ questions to create your first mock test.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="test-page">
      <Link className="back-link" href="/">
        ← Back to dashboard
      </Link>
      <section className="test-intro">
        <div className="panel-kicker">MOCK TEST</div>
        <h1>{mockTest.name}</h1>
        <p>
          {mockTest.testQuestions.length} questions · {mockTest.timeLimitMinutes} minutes
        </p>
        <div className="test-rules">
          <div>
            <strong>+{mockTest.marksPerCorrect}</strong>
            <span>correct answer</span>
          </div>
          <div>
            <strong>0</strong>
            <span>unanswered</span>
          </div>
          <div>
            <strong>-{mockTest.negativeMarksPerIncorrect}</strong>
            <span>incorrect answer</span>
          </div>
        </div>
        <StartTestButton mockTestId={mockTest.id} />
      </section>

      {history.length > 0 ? (
        <section className="test-intro" style={{ marginTop: "24px" }}>
          <div className="panel-kicker">TEST HISTORY</div>
          <div className="task-list" style={{ marginTop: "16px" }}>
            {history.map((attempt) => (
              <article className="task-row" key={attempt.id}>
                <div className="task-info">
                  <strong>{attempt.mockTest.name}</strong>
                  <span>
                    {attempt.submittedAt?.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · Score{" "}
                    {attempt.score} · {Math.round(attempt.accuracy ?? 0)}% accuracy
                  </span>
                </div>
                <Link className="start-button" href={`/mock-tests/${attempt.id}/result`}>
                  Review <span>→</span>
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
