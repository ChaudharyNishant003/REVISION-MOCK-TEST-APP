import { redirect } from "next/navigation";
import Link from "next/link";

import { requireUserId } from "@/lib/session";
import { getCurrentUserExam } from "@/lib/data/exam";
import AddSubjectForm from "./add-subject-form";
import AddChapterForm from "./add-chapter-form";
import AddTopicForm from "./add-topic-form";
import DeleteTopicButton from "./delete-topic-button";
import GeneratePlanButton from "./generate-plan-button";

export default async function SyllabusPage() {
  const userId = await requireUserId();
  const exam = await getCurrentUserExam(userId);

  if (!exam) redirect("/onboarding/exam");

  const totalTopics = exam.subjects.reduce(
    (sum, s) => sum + s.chapters.reduce((cSum, c) => cSum + c.topics.length, 0),
    0
  );

  return (
    <main className="onboarding-page">
      <div className="onboarding-header">
        <div className="step-indicator">
          <span className="step-dot done" />
          <span className="step-dot done" />
          <span className="step-dot current" />
        </div>
        <p className="panel-kicker">STEP 3 OF 3</p>
        <h1>Build your syllabus</h1>
        <p>Subject → Chapter → Topic. Add as much as you have now — you can add more later.</p>
      </div>

      <section className="onboarding-card">
        <AddSubjectForm />

        {exam.subjects.length === 0 ? (
          <div className="empty-state">No subjects yet. Add your first one above.</div>
        ) : (
          exam.subjects.map((subject) => (
            <div className="syllabus-subject" key={subject.id}>
              <h3>{subject.name}</h3>
              <AddChapterForm subjectId={subject.id} />
              {subject.chapters.map((chapter) => (
                <div className="syllabus-chapter" key={chapter.id}>
                  <h4>{chapter.name}</h4>
                  {chapter.topics.map((topic) => (
                    <div className="syllabus-topic-row" key={topic.id}>
                      <span>
                        {topic.name}
                        <span className="syllabus-topic-meta">
                          {topic.estimatedRevisionMinutes} min · {topic.difficulty} · {topic.importance} importance
                        </span>
                      </span>
                      <DeleteTopicButton topicId={topic.id} />
                    </div>
                  ))}
                  <AddTopicForm chapterId={chapter.id} />
                </div>
              ))}
            </div>
          ))
        )}
      </section>

      <div className="onboarding-footer">
        <Link className="secondary-button" href="/onboarding/availability">
          ← Back
        </Link>
        <GeneratePlanButton disabled={totalTopics === 0} />
      </div>
    </main>
  );
}
