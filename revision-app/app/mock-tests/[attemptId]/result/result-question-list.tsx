"use client";

import { useState } from "react";

type Status = "correct" | "incorrect" | "skipped";

type ReviewItem = {
  id: string;
  index: number;
  questionText: string;
  status: Status;
  selectedLabel: string | null;
  selectedText: string | null;
  correctLabel: string;
  correctText: string | undefined;
};

const TABS: { key: Status | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "incorrect", label: "Incorrect" },
  { key: "skipped", label: "Skipped" },
  { key: "correct", label: "Correct" },
];

export default function ResultQuestionList({ items }: { items: ReviewItem[] }) {
  const [tab, setTab] = useState<Status | "all">("all");
  const counts: Record<Status, number> = {
    correct: items.filter((i) => i.status === "correct").length,
    incorrect: items.filter((i) => i.status === "incorrect").length,
    skipped: items.filter((i) => i.status === "skipped").length,
  };
  const visible = items.filter((i) => tab === "all" || i.status === tab);

  return (
    <div>
      <div className="review-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? "review-tab active" : "review-tab"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key !== "all" ? ` (${counts[t.key]})` : ` (${items.length})`}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="empty-state">No questions in this category.</p>
      ) : (
        visible.map((item) => (
          <div className="review-row" key={item.id}>
            <h3>
              Q{item.index}. {item.questionText}
            </h3>
            <div className="review-answer">
              <span className={`review-tag ${item.status}`}>{item.status}</span>
              <span>Your answer: {item.selectedLabel ? `${item.selectedLabel}. ${item.selectedText}` : "Not answered"}</span>
            </div>
            {item.status !== "correct" && (
              <div className="review-answer">
                <span className="review-tag correct">correct</span>
                <span>
                  {item.correctLabel}. {item.correctText}
                </span>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
