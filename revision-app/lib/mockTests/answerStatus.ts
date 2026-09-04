/** The four states an in-progress answer can hold (Document 03 §17). */
export type AnswerStatus = "unanswered" | "answered" | "marked_for_review" | "answered_marked_for_review";

export function resolveAnswerStatus(answered: boolean, isMarkedForReview: boolean): AnswerStatus {
  if (answered && isMarkedForReview) return "answered_marked_for_review";
  if (answered) return "answered";
  if (isMarkedForReview) return "marked_for_review";
  return "unanswered";
}

/** Per-tick active viewing time is capped so one long idle stretch can't distort a question's timing. */
export const MAX_TIME_INCREMENT_SECONDS = 300;

export function cappedTimeIncrement(deltaSeconds: number): number {
  return Math.min(MAX_TIME_INCREMENT_SECONDS, Math.round(deltaSeconds));
}
