import { redirect } from "next/navigation";
import Link from "next/link";

import { requireUserId, getCurrentUser } from "@/lib/session";
import { getCurrentUserExam } from "@/lib/data/exam";
import Sidebar from "@/components/sidebar";
import UploadForm from "./upload-form";

export default async function UploadQuestionsPage() {
  const userId = await requireUserId();
  const user = await getCurrentUser();
  const exam = await getCurrentUserExam(userId);
  if (!exam) redirect("/onboarding/exam");

  const topics = exam.subjects.flatMap((s) =>
    s.chapters.flatMap((c) => c.topics.map((t) => ({ id: t.id, label: `${s.name} · ${c.name} · ${t.name}` })))
  );

  return (
    <main className="app-shell">
      <Sidebar activeHref="/question-bank" userName={user?.name ?? "You"} />
      <section className="content-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">QUESTION BANK</p>
            <h1>Upload MCQ images</h1>
          </div>
          <div className="top-actions">
            <Link className="outline-button" href="/question-bank">
              ← Back to bank
            </Link>
          </div>
        </header>

        <section className="onboarding-card" style={{ maxWidth: "640px" }}>
          <p className="focus-note" style={{ maxWidth: "none", margin: "0 0 20px" }}>
            Photograph or scan a page of MCQs, name the set, and optionally tag it to one topic. Each
            image is processed independently — one bad photo never blocks the rest.
          </p>
          <UploadForm topics={topics} />
        </section>
      </section>
    </main>
  );
}
