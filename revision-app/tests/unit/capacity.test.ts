import { describe, it, expect } from "vitest";
import type { StudyAvailability } from "@prisma/client";

import { rawMinutesForDate, usableMinutesForDate, CAPACITY_BUFFER_RATIO } from "@/lib/scheduler/capacity";

/**
 * Capacity decides how much revision fits in a day. Over-estimate and the plan becomes
 * undeliverable; under-estimate and the candidate runs out of runway before the exam.
 */
function slot(dayOfWeek: number, startTime: string, endTime: string): StudyAvailability {
  return {
    id: `slot-${dayOfWeek}-${startTime}`,
    examId: "exam-1",
    dayOfWeek,
    startTime,
    endTime,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// 2026-09-07 is a Monday (getDay() === 1).
const MONDAY = new Date(2026, 8, 7);
const TUESDAY = new Date(2026, 8, 8);
const SUNDAY = new Date(2026, 8, 6);

describe("rawMinutesForDate", () => {
  it("returns the minutes of a single matching slot", () => {
    expect(rawMinutesForDate(MONDAY, [slot(1, "19:00", "21:00")])).toBe(120);
  });

  it("sums multiple slots on the same day", () => {
    const availability = [slot(1, "19:00", "21:00"), slot(1, "09:00", "13:00")];
    expect(rawMinutesForDate(MONDAY, availability)).toBe(360); // 120 + 240
  });

  it("ignores slots belonging to other days", () => {
    const availability = [slot(1, "19:00", "21:00"), slot(2, "09:00", "13:00")];
    expect(rawMinutesForDate(MONDAY, availability)).toBe(120);
    expect(rawMinutesForDate(TUESDAY, availability)).toBe(240);
  });

  it("returns 0 for a day with no configured availability", () => {
    expect(rawMinutesForDate(SUNDAY, [slot(1, "19:00", "21:00")])).toBe(0);
    expect(rawMinutesForDate(MONDAY, [])).toBe(0);
  });

  it("handles minute-level precision, not just whole hours", () => {
    expect(rawMinutesForDate(MONDAY, [slot(1, "19:15", "20:45")])).toBe(90);
  });

  it("clamps an inverted slot to zero rather than subtracting time", () => {
    // Validation should prevent this reaching the database, but the engine must not
    // produce negative capacity if a bad row ever exists.
    expect(rawMinutesForDate(MONDAY, [slot(1, "21:00", "19:00")])).toBe(0);
  });
});

describe("usableMinutesForDate", () => {
  it("applies the 85% capacity buffer (Document 02 §11)", () => {
    expect(CAPACITY_BUFFER_RATIO).toBe(0.85);
    expect(usableMinutesForDate(MONDAY, [slot(1, "19:00", "21:00")])).toBe(102); // floor(120 * 0.85)
    expect(usableMinutesForDate(MONDAY, [slot(1, "09:00", "13:00")])).toBe(204); // floor(240 * 0.85)
  });

  it("floors rather than rounds, so the plan never over-commits the day", () => {
    // 90 * 0.85 = 76.5 → 76, not 77.
    expect(usableMinutesForDate(MONDAY, [slot(1, "19:15", "20:45")])).toBe(76);
  });

  it("returns 0 when there is no availability", () => {
    expect(usableMinutesForDate(SUNDAY, [slot(1, "19:00", "21:00")])).toBe(0);
  });

  it("always leaves buffer — usable is strictly less than raw for any real slot", () => {
    const availability = [slot(1, "19:00", "21:00")];
    expect(usableMinutesForDate(MONDAY, availability)).toBeLessThan(rawMinutesForDate(MONDAY, availability));
  });
});
