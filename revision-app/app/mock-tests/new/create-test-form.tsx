"use client";

import { useActionState, useMemo, useState } from "react";

import { createMockTestAction, type FormState } from "@/lib/actions/mockTestConfig";

type QuestionRow = {
  id: string;
  questionText: string;
  questionSet: { id: string; name: string };
  topic: { id: string; name: string; chapter: { subject: { name: string } } } | null;
};

const initialState: FormState = null;

export default function CreateTestForm({ questions }: { questions: QuestionRow[] }) {
  const [state, formAction, pending] = useActionState(createMockTestAction, initialState);
  const [search, setSearch] = useState("");
  const [setFilter, setSetFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const questionSets = useMemo(() => {
    const map = new Map<string, string>();
    questions.forEach((q) => map.set(q.questionSet.id, q.questionSet.name));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [questions]);

  const topics = useMemo(() => {
    const map = new Map<string, string>();
    questions.forEach((q) => q.topic && map.set(q.topic.id, q.topic.name));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [questions]);

  function isVisible(q: QuestionRow) {
    if (setFilter !== "all" && q.questionSet.id !== setFilter) return false;
    if (topicFilter !== "all" && q.topic?.id !== topicFilter) return false;
    if (search.trim() && !q.questionText.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="onboarding-card" style={{ maxWidth: "820px", margin: "20px auto 0" }}>
      {state?.error ? <div className="form-error" style={{ marginBottom: "16px" }}>{state.error}</div> : null}

      <div className="inline-form" style={{ marginBottom: "18px" }}>
        <div className="field">
          <label>Test name</label>
          <input name="name" type="text" placeholder="Mock Test 2" required maxLength={120} />
        </div>
        <div className="field" style={{ minWidth: "110px", flex: "0 0 110px" }}>
          <label>Minutes</label>
          <input name="timeLimitMinutes" type="number" min={1} max={300} defaultValue={30} required />
        </div>
        <div className="field" style={{ minWidth: "130px", flex: "0 0 130px" }}>
          <label>Marks / correct</label>
          <input name="marksPerCorrect" type="number" step="0.25" min={0.25} defaultValue={1} required />
        </div>
        <div className="field" style={{ minWidth: "150px", flex: "0 0 150px" }}>
          <label>Negative / incorrect</label>
          <input name="negativeMarksPerIncorrect" type="number" step="0.25" min={0} defaultValue={0.25} required />
        </div>
      </div>

      <div className="panel-kicker" style={{ marginBottom: "10px" }}>
        QUESTIONS · {selected.size} selected of {questions.length} approved
      </div>
      <div className="inline-form" style={{ marginBottom: "10px" }}>
        <div className="field">
          <label>Search</label>
          <input type="text" placeholder="Filter by question text" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="field" style={{ minWidth: "170px", flex: "0 0 170px" }}>
          <label>Question set</label>
          <select value={setFilter} onChange={(e) => setSetFilter(e.target.value)}>
            <option value="all">All sets</option>
            {questionSets.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ minWidth: "170px", flex: "0 0 170px" }}>
          <label>Topic</label>
          <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
            <option value="all">All topics</option>
            {topics.map((t) => (
              <option value={t.id} key={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="question-picker-list">
        {questions.map((q) => (
          <label
            className="question-picker-row"
            key={q.id}
            style={isVisible(q) ? undefined : { display: "none" }}
          >
            <input
              type="checkbox"
              name="questionIds"
              value={q.id}
              onChange={() => toggle(q.id)}
            />
            <span className="question-picker-text">{q.questionText}</span>
            <span className="question-picker-meta">
              {q.topic ? `${q.topic.chapter.subject.name} · ${q.topic.name}` : q.questionSet.name}
            </span>
          </label>
        ))}
      </div>

      <div className="onboarding-footer" style={{ maxWidth: "none", margin: "22px 0 0" }}>
        <span className="focus-note" style={{ margin: 0, maxWidth: "none" }}>
          {selected.size === 0 ? "Select at least one question to continue." : `Ready to create with ${selected.size} question${selected.size === 1 ? "" : "s"}.`}
        </span>
        <button className="primary-button" type="submit" disabled={pending || selected.size === 0}>
          {pending ? "Creating…" : "Create test"} <span>→</span>
        </button>
      </div>
    </form>
  );
}
