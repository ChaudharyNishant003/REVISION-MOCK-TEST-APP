import { describe, it, expect } from "vitest";

import {
  calculatePriorityScore,
  baseRevisionGapDays,
  nextRevisionGapDays,
} from "@/lib/scheduler/priority";

/**
 * Priority scoring decides what the candidate revises next, so a drift here silently
 * reorders their whole study plan. Expected values are computed by hand from the
 * documented weights (Document 02 §5-8): importance low/medium/high = 4/9/16,
 * difficulty easy/medium/hard = 2/6/11, confidence strong/okay/weak = -12/0/+14.
 */
describe("calculatePriorityScore", () => {
  const base = { daysUntilExam: 60, totalPrepWindowDays: 60 } as const;

  it("sums importance and difficulty weights with no other signals", () => {
    expect(calculatePriorityScore({ ...base, importance: "high", difficulty: "medium" })).toBe(22);
    expect(calculatePriorityScore({ ...base, importance: "low", difficulty: "easy" })).toBe(6);
    expect(calculatePriorityScore({ ...base, importance: "high", difficulty: "hard" })).toBe(27);
    expect(calculatePriorityScore({ ...base, importance: "medium", difficulty: "medium" })).toBe(15);
  });

  it("raises priority for weak confidence and lowers it for strong", () => {
    const weak = calculatePriorityScore({ ...base, importance: "high", difficulty: "medium", lastConfidence: "weak" });
    const okay = calculatePriorityScore({ ...base, importance: "high", difficulty: "medium", lastConfidence: "okay" });
    const strong = calculatePriorityScore({ ...base, importance: "high", difficulty: "medium", lastConfidence: "strong" });

    expect(weak).toBe(36); // 22 + 14
    expect(okay).toBe(22); // 22 + 0
    expect(strong).toBe(10); // 22 - 12
    expect(weak).toBeGreaterThan(strong);
  });

  it("escalates overdue work but caps the boost at +30", () => {
    expect(calculatePriorityScore({ ...base, importance: "high", difficulty: "medium", daysOverdue: 3 })).toBe(40); // +18
    expect(calculatePriorityScore({ ...base, importance: "high", difficulty: "medium", daysOverdue: 5 })).toBe(52); // +30 (capped)
    // Well past the cap: a very old task must not dominate the list forever.
    expect(calculatePriorityScore({ ...base, importance: "high", difficulty: "medium", daysOverdue: 60 })).toBe(52);
  });

  it("caps the days-since-last-revision boost at +15", () => {
    expect(
      calculatePriorityScore({ ...base, importance: "high", difficulty: "medium", daysSinceLastRevision: 5 })
    ).toBe(26); // +4
    expect(
      calculatePriorityScore({ ...base, importance: "high", difficulty: "medium", daysSinceLastRevision: 100 })
    ).toBe(37); // +15 (capped)
  });

  it("adjusts for recent mock-test accuracy in the documented bands", () => {
    const withAccuracy = (recentMockAccuracy: number) =>
      calculatePriorityScore({ ...base, importance: "high", difficulty: "medium", recentMockAccuracy });

    expect(withAccuracy(40)).toBe(40); // <50 → +18
    expect(withAccuracy(60)).toBe(30); // <70 → +8
    expect(withAccuracy(75)).toBe(22); // 70-89 → unchanged
    expect(withAccuracy(95)).toBe(16); // >=90 → -6
  });

  it("treats accuracy band edges exactly as documented", () => {
    const withAccuracy = (recentMockAccuracy: number) =>
      calculatePriorityScore({ ...base, importance: "high", difficulty: "medium", recentMockAccuracy });

    expect(withAccuracy(49.9)).toBe(40); // still <50
    expect(withAccuracy(50)).toBe(30); // no longer <50, but <70
    expect(withAccuracy(69.9)).toBe(30); // still <70
    expect(withAccuracy(70)).toBe(22); // neutral band
    expect(withAccuracy(89.9)).toBe(22); // still neutral
    expect(withAccuracy(90)).toBe(16); // >=90
  });

  it("protects high-importance topics in the final week", () => {
    // 30-day window → threshold = min(7, round(6)) = 6; 3 days out is inside it.
    const finalWeek = { daysUntilExam: 3, totalPrepWindowDays: 30 } as const;
    expect(calculatePriorityScore({ ...finalWeek, importance: "high", difficulty: "medium" })).toBe(32); // 22 + 10
  });

  it("de-prioritizes low-importance topics already rated strong in the final week", () => {
    const finalWeek = { daysUntilExam: 3, totalPrepWindowDays: 30 } as const;
    // 4 (low) + 6 (medium) - 12 (strong) - 8 (final-week de-prioritization) = -10
    expect(
      calculatePriorityScore({ ...finalWeek, importance: "low", difficulty: "medium", lastConfidence: "strong" })
    ).toBe(-10);
  });

  it("applies no final-week adjustment outside the threshold", () => {
    const wellBefore = { daysUntilExam: 20, totalPrepWindowDays: 30 } as const;
    expect(calculatePriorityScore({ ...wellBefore, importance: "high", difficulty: "medium" })).toBe(22);
  });

  it("rounds to a single decimal place", () => {
    // daysSinceLastRevision 3 → +2.4 exactly
    expect(calculatePriorityScore({ ...base, importance: "high", difficulty: "medium", daysSinceLastRevision: 3 })).toBe(24.4);
  });

  it("ignores a zero or absent overdue count", () => {
    expect(calculatePriorityScore({ ...base, importance: "high", difficulty: "medium", daysOverdue: 0 })).toBe(22);
  });
});

describe("baseRevisionGapDays", () => {
  it("widens the gap as the revision number climbs", () => {
    expect(baseRevisionGapDays(1)).toBe(3);
    expect(baseRevisionGapDays(2)).toBe(5);
    expect(baseRevisionGapDays(3)).toBe(7);
    expect(baseRevisionGapDays(4)).toBe(10);
    expect(baseRevisionGapDays(9)).toBe(10);
  });
});

describe("nextRevisionGapDays", () => {
  it("uses the base gap when no confidence was recorded", () => {
    expect(nextRevisionGapDays(1, undefined, 60)).toBe(3);
    expect(nextRevisionGapDays(2, null, 60)).toBe(5);
  });

  it("widens the gap after strong confidence and narrows it after weak", () => {
    expect(nextRevisionGapDays(1, "strong", 60)).toBe(4); // round(3 * 1.4)
    expect(nextRevisionGapDays(1, "weak", 60)).toBe(2); // max(2, round(3 * 0.5))
    expect(nextRevisionGapDays(3, "strong", 60)).toBe(10); // round(7 * 1.4)
    expect(nextRevisionGapDays(3, "weak", 60)).toBe(4); // round(7 * 0.5)
  });

  it("never schedules past the exam", () => {
    // Base gap of 10 widened to 14, but only 5 days remain → clamped to 4.
    expect(nextRevisionGapDays(4, "strong", 5)).toBe(4);
    expect(nextRevisionGapDays(4, undefined, 3)).toBe(2);
  });

  it("never returns less than 1 day, even on the eve of the exam", () => {
    expect(nextRevisionGapDays(1, undefined, 1)).toBe(1);
    expect(nextRevisionGapDays(1, "weak", 0)).toBe(1);
  });
});
