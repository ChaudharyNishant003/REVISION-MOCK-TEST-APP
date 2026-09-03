import { redirect } from "next/navigation";

import { requireUserId, getCurrentUser } from "@/lib/session";
import { getCurrentUserExam } from "@/lib/data/exam";
import { getRevisionProgressSummary } from "@/lib/scheduler/dailyTasks";
import { getAllTopicProfiles } from "@/lib/data/analytics";
import { getAttemptHistory } from "@/lib/data/mockTestAttempt";
import Sidebar from "@/components/sidebar";

const ATTENTION_LABEL: Record<string, string> = {
  high_attention: "High attention",
  needs_attention: "Needs attention",
  stable: "Stable",
  strong: "Strong",
  limited_data: "Limited data",
};

export default async function AnalyticsPage() {
  const userId = await requireUserId();
  const user = await getCurrentUser();
  const exam = await getCurrentUserExam(userId);
  if (!exam) redirect("/onboarding/exam");

  const [progress, profiles, attempts] = await Promise.all([
    getRevisionProgressSummary(exam.id),
    getAllTopicProfiles(exam.id),
    getAttemptHistory(userId, exam.id),
  ]);

  return (
    <main className="app-shell">
      <Sidebar activeHref="/analytics" userName={user?.name ?? "You"} />
      <section className="content-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">ANALYTICS</p>
            <h1>Where you actually stand</h1>
          </div>
        </header>

        <div className="dashboard-grid">
          <section className="focus-panel panel">
            <div className="panel-kicker">REVISION PROGRESS</div>
            <div className="mini-stats" style={{ paddingTop: "17px", marginTop: "18px", flexWrap: "wrap", gap: "22px" }}>
              <div>
                <strong>
                  {progress.revisedTopics} / {progress.totalTopics}
                </strong>
                <span>topics revised</span>
              </div>
              <div>
                <strong>{progress.overdue}</strong>
                <span>overdue</span>
              </div>
              <div>
                <strong>{progress.dueToday}</strong>
                <span>due today</span>
              </div>
            </div>
          </section>

          <section className="focus-panel panel">
            <div className="panel-kicker">MOCK TESTS TAKEN</div>
            <div className="mini-stats" style={{ paddingTop: "17px", marginTop: "18px" }}>
              <div>
                <strong>{attempts.length}</strong>
                <span>submitted attempts</span>
              </div>
              {attempts[0] ? (
                <div>
                  <strong>{Math.round(attempts[0].accuracy ?? 0)}%</strong>
                  <span>most recent accuracy</span>
                </div>
              ) : null}
            </div>
          </section>

          <section className="attention-panel panel" style={{ gridColumn: "1 / -1" }}>
            <div className="section-heading">
              <div>
                <div className="panel-kicker">TOPIC PERFORMANCE</div>
                <h2>By attention level</h2>
              </div>
            </div>
            {profiles.length === 0 ? (
              <p className="empty-state" style={{ padding: "20px 0" }}>
                Complete a mock test to start tracking performance.
              </p>
            ) : (
              profiles.map((profile) => (
                <div className="attention-item" key={profile.id}>
                  <div
                    className={`attention-bar ${
                      profile.attentionLevel === "high_attention"
                        ? "coral-bar"
                        : profile.attentionLevel === "needs_attention"
                          ? "amber-bar"
                          : ""
                    }`}
                    style={profile.attentionLevel === "strong" ? { background: "#39725c" } : undefined}
                  />
                  <div>
                    <strong>{profile.topic.name}</strong>
                    <span>
                      {profile.topic.chapter.subject.name} · {ATTENTION_LABEL[profile.attentionLevel]} ·{" "}
                      {profile.questionsAttempted} question{profile.questionsAttempted === 1 ? "" : "s"} attempted
                    </span>
                  </div>
                  <span className="attention-score">{profile.accuracy != null ? `${Math.round(profile.accuracy)}%` : "—"}</span>
                </div>
              ))
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
