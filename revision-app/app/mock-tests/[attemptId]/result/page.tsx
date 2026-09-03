import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { requireUserId } from "@/lib/session";
import { getAttemptForUser } from "@/lib/data/mockTestAttempt";

export default async function AttemptResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const userId = await requireUserId();
  const attempt = await getAttemptForUser(attemptId, userId);

  if (!attempt) notFound();
  if (attempt.status === "in_progress") redirect(`/mock-tests/${attemptId}`);

  const minutes = Math.floor((attempt.totalTimeSeconds ?? 0) / 60);
  const seconds = (attempt.totalTimeSeconds ?? 0) % 60;

  return (
    <main className="test-page">
      <Link className="back-link" href="/mock-tests">
        ← Back to mock tests
      </Link>
      <section className="result-card">
        <span className="panel-kicker">{attempt.mockTest.name} · COMPLETE</span>
        <h1>{attempt.score}</h1>
        <p className="result-summary">
          {attempt.correctCount} correct out of {attempt.attemptQuestions.length} questions.
        </p>
        <div className="result-stats-row">
          <div>
            <strong>{Math.round(attempt.accuracy ?? 0)}%</strong>
            <span>Accuracy</span>
          </div>
          <div>
            <strong>{attempt.correctCount}</strong>
            <span>Correct</span>
          </div>
          <div>
            <strong>{attempt.incorrectCount}</strong>
            <span>Incorrect</span>
          </div>
          <div>
            <strong>{attempt.skippedCount}</strong>
            <span>Skipped</span>
          </div>
          <div>
            <strong>
              {minutes}m {seconds}s
            </strong>
            <span>Time used</span>
          </div>
        </div>

        <div>
          {attempt.attemptQuestions.map((aq, index) => {
            const selected = aq.answer?.selectedOptionLabel ?? null;
            const status = selected == null ? "skipped" : selected === aq.correctAnswerSnapshot ? "correct" : "incorrect";
            const options = JSON.parse(aq.optionsSnapshot) as { label: string; text: string }[];
            return (
              <div className="review-row" key={aq.id}>
                <h3>
                  Q{index + 1}. {aq.questionTextSnapshot}
                </h3>
                <div className="review-answer">
                  <span className={`review-tag ${status}`}>{status}</span>
                  <span>
                    Your answer: {selected ? `${selected}. ${options.find((o) => o.label === selected)?.text}` : "Not answered"}
                  </span>
                </div>
                {status !== "correct" && (
                  <div className="review-answer">
                    <span className="review-tag correct">Correct</span>
                    <span>
                      {aq.correctAnswerSnapshot}. {options.find((o) => o.label === aq.correctAnswerSnapshot)?.text}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="result-actions">
          <Link className="outline-button" href="/mock-tests">
            Test history
          </Link>
          <Link className="outline-button" href="/">
            Return home
          </Link>
        </div>
      </section>
    </main>
  );
}
