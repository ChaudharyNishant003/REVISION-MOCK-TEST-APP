import { redirect } from "next/navigation";

import { requireUserId, getCurrentUser } from "@/lib/session";
import { getCurrentUserExam } from "@/lib/data/exam";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/sidebar";

export default async function QuestionBankPage() {
  const userId = await requireUserId();
  const user = await getCurrentUser();
  const exam = await getCurrentUserExam(userId);
  if (!exam) redirect("/onboarding/exam");

  const questions = await prisma.question.findMany({
    where: { questionSet: { examId: exam.id } },
    include: { questionSet: true, topic: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="app-shell">
      <Sidebar activeHref="/question-bank" userName={user?.name ?? "You"} />
      <section className="content-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">QUESTION BANK</p>
            <h1>{questions.length} approved question{questions.length === 1 ? "" : "s"}</h1>
          </div>
        </header>

        <section className="onboarding-card" style={{ maxWidth: "none", margin: "0 0 20px" }}>
          <p className="focus-note" style={{ maxWidth: "none", margin: 0 }}>
            Uploading MCQ images and extracting them with AI needs an <code>OPENAI_API_KEY</code> in the
            server&apos;s <code>.env</code> — that pipeline isn&apos;t wired up yet. This list shows what&apos;s
            already in the bank.
          </p>
        </section>

        <section className="tasks-section" style={{ marginTop: 0 }}>
          <div className="task-list">
            {questions.length === 0 ? (
              <div className="empty-state">Upload images containing MCQs to begin.</div>
            ) : (
              questions.map((q) => (
                <article className="task-row" key={q.id}>
                  <div className="task-info">
                    <strong>{q.questionText}</strong>
                    <span>
                      {q.questionSet.name} {q.topic ? `· ${q.topic.name}` : ""}
                    </span>
                  </div>
                  <span className={`task-tone ${q.approvalStatus === "approved" ? "mint" : "amber"}`}>
                    {q.approvalStatus}
                  </span>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
