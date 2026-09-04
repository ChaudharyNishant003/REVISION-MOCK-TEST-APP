import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { requireUserId, getCurrentUser } from "@/lib/session";
import { getCurrentUserExam } from "@/lib/data/exam";
import { getQuestionSetDetail } from "@/lib/data/questionSets";
import Sidebar from "@/components/sidebar";
import ProcessImageButton from "./process-image-button";
import ReviewQuestionCard from "../../review-question-card";

const IMAGE_STATUS_LABEL: Record<string, string> = {
  uploaded: "Not processed yet",
  processing: "Processing…",
  completed: "Processed",
  failed: "Failed",
};

export default async function QuestionSetPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const userId = await requireUserId();
  const user = await getCurrentUser();
  const [exam, set] = await Promise.all([getCurrentUserExam(userId), getQuestionSetDetail(setId, userId)]);
  if (!exam) redirect("/onboarding/exam");
  if (!set) notFound();

  const topics = exam.subjects.flatMap((s) =>
    s.chapters.flatMap((c) => c.topics.map((t) => ({ id: t.id, label: `${s.name} · ${c.name} · ${t.name}` })))
  );

  const needsReview = set.questions.filter((q) => q.approvalStatus === "draft" || q.approvalStatus === "needs_review");
  const approved = set.questions.filter((q) => q.approvalStatus === "approved");
  const rejected = set.questions.filter((q) => q.approvalStatus === "rejected");

  return (
    <main className="app-shell">
      <Sidebar activeHref="/question-bank" userName={user?.name ?? "You"} />
      <section className="content-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">QUESTION SET</p>
            <h1>{set.name}</h1>
          </div>
          <div className="top-actions">
            <Link className="outline-button" href="/question-bank">
              ← Back to bank
            </Link>
          </div>
        </header>

        <section className="onboarding-card" style={{ maxWidth: "none", margin: "0 0 24px" }}>
          <div className="panel-kicker" style={{ marginBottom: "14px" }}>
            SOURCE IMAGES · {set.sourceImages.length}
          </div>
          <div>
            {set.sourceImages.map((image) => (
              <div className="image-row" key={image.id}>
                <span className="name">{image.originalFileName}</span>
                <span className={`task-tone ${image.processingStatus === "completed" ? "mint" : image.processingStatus === "failed" ? "coral" : "amber"}`}>
                  {IMAGE_STATUS_LABEL[image.processingStatus] ?? image.processingStatus}
                </span>
                <div className="status-actions">
                  <ProcessImageButton imageId={image.id} status={image.processingStatus} />
                </div>
                {image.errorMessage ? <span className="error">{image.errorMessage}</span> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="tasks-section" style={{ marginTop: 0 }}>
          <div className="section-heading">
            <div>
              <div className="panel-kicker">NEEDS REVIEW</div>
              <h2>{needsReview.length} draft question{needsReview.length === 1 ? "" : "s"}</h2>
            </div>
          </div>
          {needsReview.length === 0 ? (
            <div className="empty-state">
              Nothing to review yet — process an image above, or every extracted question here has already
              been approved or rejected.
            </div>
          ) : (
            <div>
              {needsReview.map((question) => (
                <ReviewQuestionCard key={question.id} question={question} topics={topics} />
              ))}
            </div>
          )}
        </section>

        {approved.length > 0 ? (
          <section className="onboarding-card" style={{ maxWidth: "none", margin: "24px 0 0" }}>
            <div className="panel-kicker" style={{ marginBottom: "14px" }}>
              APPROVED FROM THIS SET · {approved.length}
            </div>
            <div className="task-list">
              {approved.map((q) => (
                <article className="task-row" key={q.id}>
                  <div className="task-info">
                    <strong>{q.questionText}</strong>
                    <span>{q.topic ? `${q.topic.chapter.subject.name} · ${q.topic.name}` : "No topic assigned"}</span>
                  </div>
                  <span className="task-tone mint">approved</span>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {rejected.length > 0 ? (
          <p className="focus-note" style={{ maxWidth: "none", marginTop: "18px" }}>
            {rejected.length} question{rejected.length === 1 ? "" : "s"} from this set {rejected.length === 1 ? "was" : "were"} rejected during review and won&apos;t appear in the question bank.
          </p>
        ) : null}
      </section>
    </main>
  );
}
