import { describe, it, expect } from "vitest";

import { calculateAttemptScore, type ScorableAnswer } from "@/lib/mockTests/scoring";

/**
 * Scoring is the highest-stakes pure function in the product: a wrong number here
 * sends the candidate to revise the wrong topics. Every expected value below is
 * hand-calculated, not derived from the implementation.
 */
describe("calculateAttemptScore", () => {
  const answer = (selected: string | null, correct: string): ScorableAnswer => ({
    selectedLabel: selected,
    correctLabel: correct,
  });

  it("scores the documented mixed case: 3 correct, 1 incorrect, 1 skipped at +2/-0.5", () => {
    const result = calculateAttemptScore(
      [
        answer("A", "A"),
        answer("B", "B"),
        answer("C", "C"),
        answer("A", "D"),
        answer(null, "B"),
      ],
      2,
      0.5
    );

    expect(result.correct).toBe(3);
    expect(result.incorrect).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.attempted).toBe(4);
    // 3 * 2 - 1 * 0.5 = 5.5
    expect(result.score).toBe(5.5);
    // 3 / 4 * 100 = 75
    expect(result.accuracy).toBe(75);
  });

  it("returns accuracy 0 (never NaN) when every question is skipped", () => {
    const result = calculateAttemptScore([answer(null, "A"), answer(null, "B")], 1, 0.25);

    expect(result.attempted).toBe(0);
    expect(result.skipped).toBe(2);
    expect(result.accuracy).toBe(0);
    expect(Number.isNaN(result.accuracy)).toBe(false);
    expect(result.score).toBe(0);
  });

  it("awards full marks with no deductions when every answer is correct", () => {
    const result = calculateAttemptScore([answer("A", "A"), answer("B", "B")], 4, 1);

    expect(result.correct).toBe(2);
    expect(result.score).toBe(8);
    expect(result.accuracy).toBe(100);
  });

  it("applies no penalty when negative marking is disabled", () => {
    const result = calculateAttemptScore([answer("A", "A"), answer("X", "B"), answer("Y", "C")], 1, 0);

    expect(result.incorrect).toBe(2);
    // 1 * 1 - 2 * 0 = 1
    expect(result.score).toBe(1);
    expect(result.accuracy).toBeCloseTo(33.333, 2);
  });

  it("can produce a negative score when penalties exceed marks earned", () => {
    const result = calculateAttemptScore([answer("A", "A"), answer("X", "B"), answer("X", "C"), answer("X", "D")], 1, 1);

    // 1 * 1 - 3 * 1 = -2
    expect(result.score).toBe(-2);
    expect(result.accuracy).toBe(25);
  });

  it("handles fractional marking schemes without floating-point drift in the counts", () => {
    const result = calculateAttemptScore([answer("A", "A"), answer("B", "B"), answer("X", "C")], 1.5, 0.25);

    expect(result.correct).toBe(2);
    expect(result.incorrect).toBe(1);
    // 2 * 1.5 - 1 * 0.25 = 2.75
    expect(result.score).toBeCloseTo(2.75, 10);
  });

  it("returns a zeroed result for an empty attempt", () => {
    const result = calculateAttemptScore([], 2, 0.5);

    expect(result).toEqual({ correct: 0, incorrect: 0, skipped: 0, attempted: 0, score: 0, accuracy: 0 });
  });

  it("treats a selected-but-wrong label as incorrect, not skipped", () => {
    const result = calculateAttemptScore([answer("D", "A")], 1, 0.25);

    expect(result.incorrect).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.attempted).toBe(1);
  });
});
