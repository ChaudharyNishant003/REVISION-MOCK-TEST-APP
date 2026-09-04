/**
 * Deterministic mock-test scoring (Document 03 §25) — never touched by AI.
 * Pure so it can be unit-tested independently of the server action that persists the result.
 */

export type ScorableAnswer = {
  /** The option label the candidate selected, or null if the question was skipped. */
  selectedLabel: string | null;
  /** The correct option label captured in the attempt snapshot. */
  correctLabel: string;
};

export type AttemptScore = {
  correct: number;
  incorrect: number;
  skipped: number;
  attempted: number;
  score: number;
  accuracy: number;
};

export function calculateAttemptScore(
  answers: ScorableAnswer[],
  marksPerCorrect: number,
  negativeMarksPerIncorrect: number
): AttemptScore {
  let correct = 0;
  let incorrect = 0;
  let skipped = 0;

  for (const answer of answers) {
    if (answer.selectedLabel == null) {
      skipped++;
    } else if (answer.selectedLabel === answer.correctLabel) {
      correct++;
    } else {
      incorrect++;
    }
  }

  const attempted = correct + incorrect;

  return {
    correct,
    incorrect,
    skipped,
    attempted,
    score: correct * marksPerCorrect - incorrect * negativeMarksPerIncorrect,
    accuracy: attempted > 0 ? (correct / attempted) * 100 : 0,
  };
}
