import { redirect } from "next/navigation";

import { requireUserId, getCurrentUser } from "@/lib/session";
import { getCurrentUserExam } from "@/lib/data/exam";
import { getMaskedOpenAiKey } from "@/lib/data/user";
import Sidebar from "@/components/sidebar";
import EditExamForm from "./edit-exam-form";
import OpenAiKeyForm from "./openai-key-form";
import AvailabilityForm from "../onboarding/availability/availability-form";
import RemoveSlotButton from "../onboarding/availability/remove-slot-button";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function SettingsPage() {
  const userId = await requireUserId();
  const user = await getCurrentUser();
  const exam = await getCurrentUserExam(userId);

  if (!exam) redirect("/onboarding/exam");

  const maskedOpenAiKey = await getMaskedOpenAiKey(userId);

  return (
    <main className="app-shell">
      <Sidebar activeHref="/settings" userName={user?.name ?? "You"} />
      <section className="content-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">SETTINGS</p>
            <h1>Exam &amp; availability</h1>
          </div>
        </header>

        <section className="onboarding-card" style={{ margin: "0 0 20px", maxWidth: "none" }}>
          <div className="panel-kicker" style={{ marginBottom: "16px" }}>
            EXAM
          </div>
          <EditExamForm name={exam.name} examDate={exam.examDate.toISOString().slice(0, 10)} />
        </section>

        <section className="onboarding-card" style={{ maxWidth: "none" }}>
          <div className="panel-kicker" style={{ marginBottom: "16px" }}>
            STUDY AVAILABILITY
          </div>
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
        </section>

        <section className="onboarding-card" style={{ maxWidth: "none", margin: "20px 0 0" }}>
          <div className="panel-kicker" style={{ marginBottom: "16px" }}>
            OPENAI API KEY
          </div>
          <OpenAiKeyForm maskedKey={maskedOpenAiKey} />
        </section>
      </section>
    </main>
  );
}
