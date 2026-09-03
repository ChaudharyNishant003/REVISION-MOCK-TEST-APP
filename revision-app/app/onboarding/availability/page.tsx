import { redirect } from "next/navigation";
import Link from "next/link";

import { requireUserId } from "@/lib/session";
import { getCurrentUserExam } from "@/lib/data/exam";
import AvailabilityForm from "./availability-form";
import RemoveSlotButton from "./remove-slot-button";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function AvailabilityPage() {
  const userId = await requireUserId();
  const exam = await getCurrentUserExam(userId);

  if (!exam) redirect("/onboarding/exam");

  const totalMinutes = exam.availability.reduce((sum, slot) => {
    const [sh, sm] = slot.startTime.split(":").map(Number);
    const [eh, em] = slot.endTime.split(":").map(Number);
    return sum + (eh * 60 + em - (sh * 60 + sm));
  }, 0);

  return (
    <main className="onboarding-page">
      <div className="onboarding-header">
        <div className="step-indicator">
          <span className="step-dot done" />
          <span className="step-dot current" />
          <span className="step-dot" />
        </div>
        <p className="panel-kicker">STEP 2 OF 3</p>
        <h1>When can you study?</h1>
        <p>Add every slot you can realistically use. The scheduler only plans inside this time.</p>
      </div>
      <section className="onboarding-card">
        <AvailabilityForm />
        <div className="slot-list">
          {exam.availability.length === 0 ? (
            <div className="empty-state">No slots added yet.</div>
          ) : (
            exam.availability.map((slot) => (
              <div className="slot-row" key={slot.id}>
                <span>
                  <strong>{DAY_NAMES[slot.dayOfWeek]}</strong> · {slot.startTime}–{slot.endTime}
                </span>
                <RemoveSlotButton slotId={slot.id} />
              </div>
            ))
          )}
        </div>
        <p className="focus-note" style={{ margin: "6px 0 0", maxWidth: "none" }}>
          Total weekly availability: <strong>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</strong>
        </p>
      </section>
      <div className="onboarding-footer">
        <Link className="secondary-button" href="/onboarding/exam">
          ← Back
        </Link>
        <Link className="primary-button" href="/onboarding/syllabus">
          Continue <span>→</span>
        </Link>
      </div>
    </main>
  );
}
