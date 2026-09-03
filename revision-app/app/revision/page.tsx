import { redirect } from "next/navigation";
import Link from "next/link";

import { requireUserId, getCurrentUser } from "@/lib/session";
import { getCurrentUserExam } from "@/lib/data/exam";
import { getTodaysTasks } from "@/lib/scheduler/dailyTasks";
import { getTopicScheduleInfo } from "@/lib/data/revisionOverview";
import Sidebar from "@/components/sidebar";
import CompleteTaskButton from "../complete-task-button";

export default async function RevisionPage() {
  const userId = await requireUserId();
  const user = await getCurrentUser();
  const exam = await getCurrentUserExam(userId);

  if (!exam) redirect("/onboarding/exam");

  const [tasks, scheduleInfo] = await Promise.all([
    getTodaysTasks(exam.id),
    getTopicScheduleInfo(exam.id),
  ]);

  return (
    <main className="app-shell">
      <Sidebar activeHref="/revision" userName={user?.name ?? "You"} />
      <section className="content-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">REVISION</p>
            <h1>Today&apos;s plan</h1>
          </div>
          <div className="top-actions">
            <Link className="outline-button" href="/onboarding/syllabus">
              Manage syllabus <span>→</span>
            </Link>
          </div>
        </header>

        <section className="tasks-section" style={{ marginTop: 0 }}>
          <div className="section-heading">
            <div>
              <div className="panel-kicker">DUE NOW</div>
              <h2>{tasks.length} task{tasks.length === 1 ? "" : "s"}</h2>
            </div>
          </div>
          <div className="task-list">
            {tasks.length === 0 ? (
              <div className="empty-state">No revisions are currently scheduled for today.</div>
            ) : (
              tasks.map((task) => (
                <article className={task.status === "overdue" ? "task-row task-highlight" : "task-row"} key={task.id}>
                  <div className="task-status">{task.revisionNumber}</div>
                  <div className="task-info">
                    <strong>{task.topic.name}</strong>
                    <span>
                      {task.topic.chapter.subject.name} · {task.topic.chapter.name}
                    </span>
                  </div>
                  <span className={`task-tone ${task.status === "overdue" ? "coral" : "amber"}`}>
                    {task.status === "overdue" ? "Overdue" : "Due today"}
                  </span>
                  <span className="task-duration">{task.estimatedMinutes} min</span>
                  <CompleteTaskButton taskId={task.id} />
                </article>
              ))
            )}
          </div>
        </section>

        <section className="onboarding-card" style={{ margin: "28px 0 0", maxWidth: "none" }}>
          <div className="panel-kicker" style={{ marginBottom: "14px" }}>
            FULL SYLLABUS
          </div>
          {exam.subjects.length === 0 ? (
            <div className="empty-state">Add your syllabus topics to generate a revision plan.</div>
          ) : (
            exam.subjects.map((subject) => (
              <div className="syllabus-subject" key={subject.id}>
                <h3>{subject.name}</h3>
                {subject.chapters.map((chapter) => (
                  <div className="syllabus-chapter" key={chapter.id}>
                    <h4>{chapter.name}</h4>
                    {chapter.topics.map((topic) => {
                      const lastRevised = scheduleInfo.lastRevisedByTopic.get(topic.id);
                      const revisionCount = scheduleInfo.revisionCountByTopic.get(topic.id) ?? 0;
                      const nextTask = scheduleInfo.nextTaskByTopic.get(topic.id);
                      return (
                        <div className="syllabus-topic-row" key={topic.id}>
                          <span>
                            {topic.name}
                            <span className="syllabus-topic-meta">
                              {revisionCount === 0 ? "Not revised yet" : `${revisionCount} revision${revisionCount === 1 ? "" : "s"} · last ${lastRevised?.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                            </span>
                          </span>
                          <span className="syllabus-topic-meta">
                            {nextTask
                              ? `Next: ${nextTask.scheduledDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                              : "No upcoming revision"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))
          )}
        </section>
      </section>
    </main>
  );
}
