import { redirect } from "next/navigation";
import Link from "next/link";

import { requireUserId } from "@/lib/session";
import { getCurrentUserExam } from "@/lib/data/exam";
import { prisma } from "@/lib/prisma";
import { getAttemptHistory } from "@/lib/data/mockTestAttempt";
import StartTestButton from "./start-test-button";
import ArchiveMockTestButton from "./archive-mock-test-button";

export default async function MockTestsPage() {
  const userId = await requireUserId();
  const exam = await getCurrentUserExam(userId);
  if (!exam) redirect("/onboarding/exam");

  const [mockTests, history] = await Promise.all([
    prisma.mockTest.findMany({
      where: { examId: exam.id, status: { not: "archived" } },
      include: { testQuestions: true },
      orderBy: { createdAt: "desc" },
    }),
    getAttemptHistory(userId, exam.id),
  ]);

  return (
    <main className="test-page">
      <Link className="back-link" href="/">
        ← Back to dashboard
      </Link>
      <section className="test-intro" style={{ margin: "14vh auto 0" }}>
        <div className="panel-kicker">MOCK TESTS</div>
        <h1 style={{ fontSize: "clamp(26px, 4vw, 38px)" }}>{mockTests.length} test{mockTests.length === 1 ? "" : "s"} ready</h1>
        <p>Sit any test below under real timed conditions, or build a new one from your approved question bank.</p>
        <div style={{ marginTop: "22px" }}>
          <Link className="primary-button" href="/mock-tests/new">
            Create test <span>→</span>
          </Link>
        </div>
      </section>

      {mockTests.length === 0 ? (
        <section className="test-intro" style={{ marginTop: "24px" }}>
          <p className="empty-state">No tests yet. Create one once you have approved questions in your bank.</p>
        </section>
      ) : (
        <section className="test-intro" style={{ marginTop: "24px" }}>
          <div className="task-list">
            {mockTests.map((mockTest) => (
              <article className="task-row" key={mockTest.id}>
                <div className="task-info">
                  <strong>{mockTest.name}</strong>
                  <span>
                    {mockTest.testQuestions.length} questions · {mockTest.timeLimitMinutes} min · +{mockTest.marksPerCorrect}/−
                    {mockTest.negativeMarksPerIncorrect}
                  </span>
                </div>
                <ArchiveMockTestButton mockTestId={mockTest.id} name={mockTest.name} />
                <StartTestButton mockTestId={mockTest.id} />
              </article>
            ))}
          </div>
        </section>
      )}

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
