import { redirect } from "next/navigation";
import Link from "next/link";

import { requireUserId, getCurrentUser } from "@/lib/session";
import { getCurrentUserExam } from "@/lib/data/exam";
import { getQuestionSetsForExam } from "@/lib/data/questionSets";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/sidebar";
import QuestionBankList from "./question-bank-list";

export default async function QuestionBankPage() {
  const userId = await requireUserId();
  const user = await getCurrentUser();
  const exam = await getCurrentUserExam(userId);
  if (!exam) redirect("/onboarding/exam");

  const [questionSets, questions] = await Promise.all([
    getQuestionSetsForExam(exam.id),
    prisma.question.findMany({
      where: { questionSet: { examId: exam.id }, approvalStatus: "approved" },
      include: {
        questionSet: true,
        topic: { include: { chapter: { include: { subject: true } } } },
        options: { orderBy: { sortOrder: "asc" } },
        extractionMetadata: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const topics = exam.subjects.flatMap((s) =>
    s.chapters.flatMap((c) => c.topics.map((t) => ({ id: t.id, label: `${s.name} · ${c.name} · ${t.name}` })))
  );

  return (
    <main className="app-shell">
      <Sidebar activeHref="/question-bank" userName={user?.name ?? "You"} />
      <section className="content-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">QUESTION BANK</p>
            <h1>{questions.length} approved question{questions.length === 1 ? "" : "s"}</h1>
          </div>
          <div className="top-actions">
            <Link className="primary-button" href="/question-bank/upload">
              Upload MCQ images <span>→</span>
            </Link>
          </div>
        </header>

        {questionSets.length > 0 ? (
          <section className="onboarding-card" style={{ maxWidth: "none", margin: "0 0 24px" }}>
            <div className="panel-kicker" style={{ marginBottom: "14px" }}>
              QUESTION SETS
            </div>
            {questionSets.map((set) => {
              const needsReview = set.questions.filter((q) => q.approvalStatus === "draft" || q.approvalStatus === "needs_review").length;
              const approvedCount = set.questions.filter((q) => q.approvalStatus === "approved").length;
              const failedImages = set.sourceImages.filter((i) => i.processingStatus === "failed").length;
              const unprocessed = set.sourceImages.filter((i) => i.processingStatus === "uploaded").length;
              return (
                <Link className="set-card" href={`/question-bank/sets/${set.id}`} key={set.id}>
                  <div className="info">
                    <strong>{set.name}</strong>
                    <span>
                      {set.sourceImages.length} image{set.sourceImages.length === 1 ? "" : "s"}
                      {unprocessed > 0 ? ` · ${unprocessed} not processed` : ""}
                      {failedImages > 0 ? ` · ${failedImages} failed` : ""}
                      {needsReview > 0 ? ` · ${needsReview} need${needsReview === 1 ? "s" : ""} review` : ""}
                      {approvedCount > 0 ? ` · ${approvedCount} approved` : ""}
                    </span>
                  </div>
                  {needsReview > 0 ? <span className="task-tone amber">review</span> : null}
                </Link>
              );
            })}
          </section>
        ) : (
          <section className="onboarding-card" style={{ maxWidth: "none", margin: "0 0 24px" }}>
            <p className="focus-note" style={{ maxWidth: "none", margin: 0 }}>
              No question sets yet. Upload a photo of any MCQ page to get started — AI extraction needs an OpenAI
              API key, which you can add in <Link href="/settings">Settings</Link> (or set{" "}
              <code>OPENAI_API_KEY</code> on the server as a fallback), but you can upload and organize sets
              either way.
            </p>
          </section>
        )}

        <QuestionBankList questions={questions} topics={topics} />
      </section>
    </main>
  );
}
