import { describe, it, expect } from "vitest";

import { resolveAnswerStatus, cappedTimeIncrement, MAX_TIME_INCREMENT_SECONDS } from "@/lib/mockTests/answerStatus";

describe("resolveAnswerStatus", () => {
  it("covers all four states of the answer state machine", () => {
    expect(resolveAnswerStatus(true, true)).toBe("answered_marked_for_review");
    expect(resolveAnswerStatus(true, false)).toBe("answered");
    expect(resolveAnswerStatus(false, true)).toBe("marked_for_review");
    expect(resolveAnswerStatus(false, false)).toBe("unanswered");
  });

  it("prioritizes the combined state when a question is both answered and flagged", () => {
    // A flagged-but-answered question must not be reported as merely "answered",
    // or the review-later list on the runner would lose it.
    expect(resolveAnswerStatus(true, true)).not.toBe("answered");
    expect(resolveAnswerStatus(true, true)).not.toBe("marked_for_review");
  });
});

describe("cappedTimeIncrement", () => {
  it("passes through normal per-question intervals unchanged", () => {
    expect(cappedTimeIncrement(1)).toBe(1);
    expect(cappedTimeIncrement(45)).toBe(45);
    expect(cappedTimeIncrement(299)).toBe(299);
  });

  it("caps a single increment at 300 seconds so an idle tab can't distort timing", () => {
    expect(cappedTimeIncrement(300)).toBe(300);
    expect(cappedTimeIncrement(301)).toBe(300);
    expect(cappedTimeIncrement(86_400)).toBe(MAX_TIME_INCREMENT_SECONDS);
  });

  it("rounds fractional seconds", () => {
    expect(cappedTimeIncrement(2.4)).toBe(2);
    expect(cappedTimeIncrement(2.6)).toBe(3);
  });
});
