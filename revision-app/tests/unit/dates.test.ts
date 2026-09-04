import { describe, it, expect } from "vitest";

import { startOfDay, endOfDay, addDays, daysBetween, daysUntilExam } from "@/lib/scheduler/dates";

describe("startOfDay / endOfDay", () => {
  it("normalizes to the first and last instant of the day", () => {
    const middayish = new Date(2026, 8, 7, 14, 32, 17, 456);

    const start = startOfDay(middayish);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
    expect(start.getDate()).toBe(7);

    const end = endOfDay(middayish);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
    expect(end.getDate()).toBe(7);
  });

  it("does not mutate the input date", () => {
    const original = new Date(2026, 8, 7, 14, 0, 0);
    const snapshot = original.getTime();
    startOfDay(original);
    endOfDay(original);
    expect(original.getTime()).toBe(snapshot);
  });
});

describe("addDays", () => {
  it("adds days within a month", () => {
    expect(addDays(new Date(2026, 8, 7), 3).getDate()).toBe(10);
  });

  it("rolls over a month boundary", () => {
    const result = addDays(new Date(2026, 0, 31), 1); // 31 Jan → 1 Feb
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(1);
  });

  it("rolls over a year boundary", () => {
    const result = addDays(new Date(2026, 11, 31), 1); // 31 Dec 2026 → 1 Jan 2027
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(1);
  });

  it("handles leap years", () => {
    const result = addDays(new Date(2028, 1, 28), 1); // 2028 is a leap year
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(29);
  });

  it("subtracts with a negative count", () => {
    expect(addDays(new Date(2026, 8, 7), -7).getDate()).toBe(31); // back into August
  });

  it("does not mutate the input date", () => {
    const original = new Date(2026, 8, 7);
    const snapshot = original.getTime();
    addDays(original, 10);
    expect(original.getTime()).toBe(snapshot);
  });
});

describe("daysBetween", () => {
  it("counts whole days between two dates", () => {
    expect(daysBetween(new Date(2026, 8, 1), new Date(2026, 8, 8))).toBe(7);
  });

  it("returns 0 for two times on the same calendar day", () => {
    expect(daysBetween(new Date(2026, 8, 7, 1, 0), new Date(2026, 8, 7, 23, 0))).toBe(0);
  });

  it("returns a negative count when the target is in the past", () => {
    expect(daysBetween(new Date(2026, 8, 8), new Date(2026, 8, 1))).toBe(-7);
  });

  it("compares by calendar day, ignoring the time of day", () => {
    // Late evening to early next morning is 1 day apart, despite being ~8 hours.
    expect(daysBetween(new Date(2026, 8, 7, 23, 30), new Date(2026, 8, 8, 7, 30))).toBe(1);
  });

  it("counts correctly across a month boundary", () => {
    expect(daysBetween(new Date(2026, 0, 28), new Date(2026, 1, 4))).toBe(7);
  });
});

describe("daysUntilExam", () => {
  it("counts days remaining from a reference date", () => {
    expect(daysUntilExam(new Date(2026, 8, 30), new Date(2026, 8, 1))).toBe(29);
  });

  it("returns 0 on exam day itself", () => {
    expect(daysUntilExam(new Date(2026, 8, 7, 9, 0), new Date(2026, 8, 7, 6, 0))).toBe(0);
  });

  it("never returns a negative number for an exam already past", () => {
    expect(daysUntilExam(new Date(2026, 8, 1), new Date(2026, 8, 30))).toBe(0);
  });
});
