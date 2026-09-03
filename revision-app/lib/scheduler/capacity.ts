import type { StudyAvailability } from "@prisma/client";

/** Target only ~85% of raw available time per Document 02 §11 — leaves buffer for overruns and catch-up. */
export const CAPACITY_BUFFER_RATIO = 0.85;

function slotMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

/** Raw minutes available on a given date, based on its day-of-week slots. */
export function rawMinutesForDate(date: Date, availability: StudyAvailability[]): number {
  const dow = date.getDay();
  return availability
    .filter((slot) => slot.dayOfWeek === dow)
    .reduce((total, slot) => total + Math.max(0, slotMinutes(slot.startTime, slot.endTime)), 0);
}

/** Usable minutes for scheduling on a given date, after the capacity buffer. */
export function usableMinutesForDate(date: Date, availability: StudyAvailability[]): number {
  return Math.floor(rawMinutesForDate(date, availability) * CAPACITY_BUFFER_RATIO);
}
