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

const TREND_ICON: Record<string, string> = {
  improving: "↑",
  declining: "↓",
  stable: "→",
};

function formatAverageTime(seconds: number | null): string {
  if (seconds == null) return "";
  const rounded = Math.round(seconds);
  if (rounded < 60) return `${rounded}s avg`;
  return `${Math.floor(rounded / 60)}m ${rounded % 60}s avg`;
}

/** Score-over-time sparkline for the last (up to 10) submitted attempts, oldest to newest. */
function AccuracyTrend({ attempts }: { attempts: { accuracy: number | null }[] }) {
  const scores = attempts.map((a) => a.accuracy ?? 0).reverse();
  if (scores.length < 2) return null;

  const width = 220;
  const height = 54;
  const padX = 4;
  const padY = 6;
  const stepX = (width - padX * 2) / (scores.length - 1);
  const y = (score: number) => padY + (height - padY * 2) * (1 - score / 100);
  const points = scores.map((score, i) => [padX + i * stepX, y(score)] as const);
  const linePath = points.map(([x, py], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${height - padY} L${points[0][0].toFixed(1)},${height - padY} Z`;
  const last = points[points.length - 1];
  const lastScore = scores[scores.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={`Accuracy across the last ${scores.length} mock tests, ending at ${Math.round(lastScore)}%`}>
      <line x1={padX} y1={y(50)} x2={width - padX} y2={y(50)} stroke="var(--line)" strokeWidth="1" strokeDasharray="2 3" />
      <path d={areaPath} fill="var(--coral-soft)" opacity="0.7" />
      <path d={linePath} fill="none" stroke="var(--coral)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3.2" fill="var(--coral)" />
      <text x={last[0]} y={Math.max(9, last[1] - 7)} textAnchor="end" fontSize="9" fontWeight="700" fill="var(--coral)">
        {Math.round(lastScore)}%
      </text>
    </svg>
  );
}

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
                <strong>{progress.totalTopics - progress.revisedTopics}</strong>
                <span>never revised</span>
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
            {attempts.length >= 2 ? (
              <div style={{ marginTop: "16px" }}>
                <AccuracyTrend attempts={attempts} />
                <div className="progress-meta" style={{ marginTop: "2px" }}>
                  <span>Oldest of last {attempts.length}</span>
                  <span>Most recent</span>
                </div>
              </div>
            ) : null}
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
                      {profile.averageTimeSeconds != null ? ` · ${formatAverageTime(profile.averageTimeSeconds)}` : ""}
                      {profile.performanceTrend ? (
                        <>
                          {" "}
                          · <span title={`Recent trend: ${profile.performanceTrend}`}>
                            {TREND_ICON[profile.performanceTrend]} {profile.performanceTrend}
                          </span>
                        </>
                      ) : null}
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
