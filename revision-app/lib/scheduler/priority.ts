// Deterministic priority scoring per Document 02 §5-8.
// AI is never involved in this calculation.

type Difficulty = "easy" | "medium" | "hard";
type Importance = "low" | "medium" | "high";
type Confidence = "strong" | "okay" | "weak";

const IMPORTANCE_WEIGHT: Record<Importance, number> = { low: 4, medium: 9, high: 16 };
const DIFFICULTY_WEIGHT: Record<Difficulty, number> = { easy: 2, medium: 6, hard: 11 };
const CONFIDENCE_WEIGHT: Record<Confidence, number> = { strong: -12, okay: 0, weak: 14 };

export interface PriorityInput {
  importance: Importance;
  difficulty: Difficulty;
  lastConfidence?: Confidence | null;
  daysOverdue?: number; // 0 if not overdue
  daysSinceLastRevision?: number | null;
  daysUntilExam: number;
  totalPrepWindowDays: number;
  recentMockAccuracy?: number | null; // 0-100, null if no data
}

/** Higher score = more urgent. Used to order today's revision tasks and pick what to schedule next. */
export function calculatePriorityScore(input: PriorityInput): number {
  let score = IMPORTANCE_WEIGHT[input.importance] + DIFFICULTY_WEIGHT[input.difficulty];

  if (input.lastConfidence) {
    score += CONFIDENCE_WEIGHT[input.lastConfidence];
  }

  if (input.daysOverdue && input.daysOverdue > 0) {
    // Overdue work escalates quickly but caps out so one very old task doesn't dominate forever.
    score += Math.min(30, input.daysOverdue * 6);
  }

  if (input.daysSinceLastRevision != null) {
    score += Math.min(15, input.daysSinceLastRevision * 0.8);
  }

  // Weak mock-test performance increases priority (Document 02 §19).
  if (input.recentMockAccuracy != null) {
    if (input.recentMockAccuracy < 50) score += 18;
    else if (input.recentMockAccuracy < 70) score += 8;
    else if (input.recentMockAccuracy >= 90) score -= 6;
  }

  // Final-week behaviour (Document 02 §17-18): protect high-importance / weak topics,
  // de-prioritize low-importance strong topics as the exam gets very close.
  const finalWeekThreshold = Math.min(7, Math.round(input.totalPrepWindowDays * 0.2));
  if (input.daysUntilExam <= finalWeekThreshold) {
    if (input.importance === "high") score += 10;
    if (input.lastConfidence === "strong" && input.importance === "low") score -= 8;
  }

  return Math.round(score * 10) / 10;
}

/** Base gap (in days) before a topic's next revision, before confidence/priority adjustment. */
export function baseRevisionGapDays(revisionNumber: number): number {
  if (revisionNumber <= 1) return 3;
  if (revisionNumber === 2) return 5;
  if (revisionNumber === 3) return 7;
  return 10;
}

/** Confidence and remaining time narrow or widen the base gap (Document 02 §7-8). */
export function nextRevisionGapDays(
  revisionNumber: number,
  confidence: Confidence | null | undefined,
  daysUntilExam: number
): number {
  let gap = baseRevisionGapDays(revisionNumber);

  if (confidence === "strong") gap = Math.round(gap * 1.4);
  else if (confidence === "weak") gap = Math.max(2, Math.round(gap * 0.5));

  // Never schedule a revision past the exam; compress the gap as the exam approaches.
  return Math.max(1, Math.min(gap, Math.max(1, daysUntilExam - 1)));
}
