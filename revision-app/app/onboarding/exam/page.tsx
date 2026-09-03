import { redirect } from "next/navigation";

import { requireUserId } from "@/lib/session";
import { getCurrentUserExam } from "@/lib/data/exam";
import ExamSetupForm from "./exam-setup-form";

export default async function ExamSetupPage() {
  const userId = await requireUserId();
  const exam = await getCurrentUserExam(userId);

  if (exam) {
    redirect("/onboarding/availability");
  }

  return (
    <main className="onboarding-page">
      <div className="onboarding-header">
        <div className="step-indicator">
          <span className="step-dot current" />
          <span className="step-dot" />
          <span className="step-dot" />
        </div>
        <p className="panel-kicker">STEP 1 OF 3</p>
        <h1>Set up your exam</h1>
        <p>The exam date becomes the scheduler&apos;s deadline for every revision.</p>
      </div>
      <section className="onboarding-card">
        <ExamSetupForm />
      </section>
    </main>
  );
}
