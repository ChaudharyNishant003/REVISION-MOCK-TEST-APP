import { redirect } from "next/navigation";
import Link from "next/link";

import { requireUserId, getCurrentUser } from "@/lib/session";
import { getCurrentUserExam } from "@/lib/data/exam";
import { getTodaysTasks, getRevisionProgressSummary } from "@/lib/scheduler/dailyTasks";
import { daysUntilExam } from "@/lib/scheduler/dates";
import { getLatestSubmittedAttempt } from "@/lib/data/mockTests";
import { getTopAttentionTopics } from "@/lib/data/analytics";
import Sidebar from "@/components/sidebar";
import CompleteTaskButton from "./complete-task-button";

export default async function Home() {
  const userId = await requireUserId();
  const user = await getCurrentUser();
  const exam = await getCurrentUserExam(userId);

  if (!exam) redirect("/onboarding/exam");

  const [tasks, progress, latestAttempt, attentionTopics] = await Promise.all([
    getTodaysTasks(exam.id),
    getRevisionProgressSummary(exam.id),
    getLatestSubmittedAttempt(userId),
    getTopAttentionTopics(exam.id),
  ]);

  const daysLeft = daysUntilExam(exam.examDate);
  const revisedRatio = progress.totalTopics > 0 ? Math.round((progress.revisedTopics / progress.totalTopics) * 100) : 0;
  const plannedMinutesToday = tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const today = new Date();

  return (
    <main className="app-shell">
      <Sidebar activeHref="/" userName={user?.name ?? "You"} />
      <section className="content-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
            <h1>Good to see you, {(user?.name ?? "there").split(" ")[0]}.</h1>
          </div>
          <div className="top-actions">
            <Link className="outline-button" href="/revision">
              View schedule <span>→</span>
            </Link>
          </div>
        </header>

        <div className="dashboard-grid">
          <section className="welcome-panel panel accent-panel">
            <div className="panel-kicker">YOUR PREPARATION WINDOW</div>
            <div className="countdown-row">
              <div>
                <span className="countdown-number">{daysLeft}</span>
                <span className="countdown-label">days until exam</span>
              </div>
              <div className="exam-copy">
                <strong>{exam.name}</strong>
                <span>
                  {exam.examDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </span>
              </div>
            </div>
            <div className="progress-track">
              <span style={{ width: `${revisedRatio}%` }} />
            </div>
            <div className="progress-meta">
              <span>Preparation progress</span>
              <strong>
                {progress.revisedTopics} of {progress.totalTopics} topics revised
              </strong>
            </div>
          </section>

          <section className="focus-panel panel">
            <div className="panel-heading">
              <div>
                <div className="panel-kicker">TODAY&apos;S FOCUS</div>
                <h2>Make today count.</h2>
              </div>
              <span className="date-badge">
                {today.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
                <br />
                <strong>{today.getDate()}</strong>
              </span>
            </div>
            <p className="focus-note">
              {tasks.length === 0
                ? "No revisions are currently scheduled for today."
                : "Work through today's list to stay on track."}
            </p>
            <div className="mini-stats">
              <div>
                <strong>
                  {progress.todayCompleted} / {progress.todayTotal}
                </strong>
                <span>tasks complete</span>
              </div>
              <div>
                <strong>
                  {Math.floor(plannedMinutesToday / 60)}h {plannedMinutesToday % 60}m
                </strong>
                <span>planned today</span>
              </div>
            </div>
          </section>

          <section className="tasks-section">
            <div className="section-heading">
              <div>
                <div className="panel-kicker">YOUR PLAN</div>
                <h2>Today&apos;s revision</h2>
              </div>
              <Link href="/revision">
                See all <span>→</span>
              </Link>
            </div>
            <div className="task-list">
              {tasks.length === 0 ? (
                <div className="empty-state">
                  Nothing due right now. {progress.totalTopics === 0 ? "Add topics to your syllabus to get started." : "Check back tomorrow."}
                </div>
              ) : (
                tasks.map((task) => (
                  <article className={task.status === "overdue" ? "task-row task-highlight" : "task-row"} key={task.id}>
                    <div className="task-status">{task.revisionNumber}</div>
                    <div className="task-info">
                      <strong>{task.topic.name}</strong>
                      <span>
                        Revision {task.revisionNumber} · {task.topic.chapter.subject.name}
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

          <section className="attention-panel panel">
            <div className="section-heading">
              <div>
                <div className="panel-kicker">NEEDS ATTENTION</div>
                <h2>Weak areas</h2>
              </div>
              <Link href="/analytics">
                Analytics <span>→</span>
              </Link>
            </div>
            {attentionTopics.length === 0 ? (
              <p className="empty-state" style={{ padding: "15px 0" }}>
                Complete a mock test to start tracking performance.
              </p>
            ) : (
              attentionTopics.map((profile) => (
                <div className="attention-item" key={profile.id}>
                  <div className={`attention-bar ${profile.attentionLevel === "high_attention" ? "coral-bar" : "amber-bar"}`} />
                  <div>
                    <strong>{profile.topic.name}</strong>
                    <span>
                      {profile.accuracy != null ? `${Math.round(profile.accuracy)}% accuracy` : "Limited data"} ·{" "}
                      {profile.attentionLevel === "high_attention" ? "high attention" : "needs review"}
                    </span>
                  </div>
                  <span className="attention-score">{profile.accuracy != null ? `${Math.round(profile.accuracy)}%` : "—"}</span>
                </div>
              ))
            )}
          </section>

          <section className="mock-panel panel">
            <div className="panel-kicker">LATEST MOCK TEST</div>
            {!latestAttempt ? (
              <p className="empty-state" style={{ padding: "20px 0" }}>
                Upload MCQ questions to create your first mock test.
              </p>
            ) : (
              <>
                <div className="mock-score-row">
                  <div>
                    <span className="mock-score">
                      {Math.round(latestAttempt.accuracy ?? 0)}
                      <span>%</span>
                    </span>
                    <span className="mock-label">overall accuracy</span>
                  </div>
                </div>
                <div className="mock-divider" />
                <div className="mock-footer">
                  <span>
                    {latestAttempt.mockTest.name} ·{" "}
                    {latestAttempt.submittedAt?.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <Link href="/mock-tests">Review result →</Link>
                </div>
              </>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
