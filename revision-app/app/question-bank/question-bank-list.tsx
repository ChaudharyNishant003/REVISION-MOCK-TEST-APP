"use client";

import { useMemo, useState, useTransition } from "react";

import { rejectQuestionAction } from "@/lib/actions/questionReview";
import ReviewQuestionCard from "./review-question-card";

type QuestionRow = {
  id: string;
  questionText: string;
  topicId: string | null;
  correctOptionId: string | null;
  questionSet: { id: string; name: string };
  topic: { id: string; name: string; chapter: { subject: { name: string } } } | null;
  options: { id: string; label: string; text: string }[];
  extractionMetadata: { aiConfidence: number | null; requiresReview: boolean } | null;
};

export default function QuestionBankList({
  questions,
  topics,
}: {
  questions: QuestionRow[];
  topics: { id: string; label: string }[];
}) {
  const [search, setSearch] = useState("");
  const [setFilter, setSetFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const questionSets = useMemo(() => {
    const map = new Map<string, string>();
    questions.forEach((q) => map.set(q.questionSet.id, q.questionSet.name));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [questions]);

  const topicFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    questions.forEach((q) => q.topic && map.set(q.topic.id, q.topic.name));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [questions]);

  const filtered = questions.filter((q) => {
    if (setFilter !== "all" && q.questionSet.id !== setFilter) return false;
    if (topicFilter !== "all" && q.topic?.id !== topicFilter) return false;
    if (search.trim() && !q.questionText.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <section className="tasks-section" style={{ marginTop: 0 }}>
      <div className="inline-form" style={{ marginBottom: "14px" }}>
        <div className="field">
          <label htmlFor="bank-search">Search</label>
          <input
            id="bank-search"
            type="text"
            placeholder="Filter by question text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field" style={{ minWidth: "180px", flex: "0 0 180px" }}>
          <label htmlFor="bank-set-filter">Question set</label>
          <select id="bank-set-filter" value={setFilter} onChange={(e) => setSetFilter(e.target.value)}>
            <option value="all">All sets</option>
            {questionSets.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ minWidth: "180px", flex: "0 0 180px" }}>
          <label htmlFor="bank-topic-filter">Topic</label>
          <select id="bank-topic-filter" value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
            <option value="all">All topics</option>
            {topicFilterOptions.map((t) => (
              <option value={t.id} key={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="task-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            {questions.length === 0 ? "Upload images containing MCQs to begin." : "No questions match these filters."}
          </div>
        ) : (
          filtered.map((q) =>
            editingId === q.id ? (
              <ReviewQuestionCard
                key={q.id}
                question={q}
                topics={topics}
                submitLabel="Save changes"
                pendingLabel="Saving…"
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <article className="task-row" key={q.id}>
                <div className="task-info">
                  <strong>{q.questionText}</strong>
                  <span>
                    {q.questionSet.name} {q.topic ? `· ${q.topic.chapter.subject.name} · ${q.topic.name}` : ""}
                  </span>
                </div>
                <span className="task-tone mint">approved</span>
                <button className="start-button" type="button" onClick={() => setEditingId(q.id)}>
                  Edit
                </button>
                <button
                  className="start-button"
                  type="button"
                  disabled={pending && archivingId === q.id}
                  onClick={() => {
                    if (confirm("Archive this question? It stops being usable in new mock tests.")) {
                      setArchivingId(q.id);
                      startTransition(() => rejectQuestionAction(q.id));
                    }
                  }}
                >
                  Archive
                </button>
              </article>
            )
          )
        )}
      </div>
    </section>
  );
}
