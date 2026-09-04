"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { saveAnswerAction, submitAttemptAction, addTimeSpentAction } from "@/lib/actions/mockTest";

type Question = {
  id: string;
  questionText: string;
  options: { label: string; text: string }[];
  selectedOptionLabel: string | null;
  isMarkedForReview: boolean;
};

export default function TestRunner({
  attemptId,
  testName,
  endsAt,
  questions: initialQuestions,
}: {
  attemptId: string;
  testName: string;
  endsAt: string;
  questions: Question[];
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [current, setCurrent] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const submittedRef = useRef(false);

  const endsAtMs = useMemo(() => new Date(endsAt).getTime(), [endsAt]);
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, endsAtMs - Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(Math.max(0, endsAtMs - Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAtMs]);

  useEffect(() => {
    if (remainingMs <= 0 && !submittedRef.current) {
      submittedRef.current = true;
      startTransition(() => submitAttemptAction(attemptId));
    }
  }, [remainingMs, attemptId]);

  // Active-time tracking per question (Document 03 §18): counts seconds only while this
  // question is on screen and the tab is visible, and flushes them when we navigate away.
  useEffect(() => {
    const questionId = questions[current]?.id;
    if (!questionId) return;
    let seconds = 0;
    const interval = setInterval(() => {
      if (!document.hidden) seconds += 1;
    }, 1000);
    return () => {
      clearInterval(interval);
      if (seconds > 0) addTimeSpentAction(questionId, seconds);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const question = questions[current];
  const answeredCount = questions.filter((q) => q.selectedOptionLabel != null).length;
  const markedCount = questions.filter((q) => q.isMarkedForReview).length;

  function persist(index: number, selectedOptionLabel: string | null, isMarkedForReview: boolean) {
    setQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], selectedOptionLabel, isMarkedForReview };
      return next;
    });
    startTransition(() => {
      saveAnswerAction(questions[index].id, selectedOptionLabel, isMarkedForReview);
    });
  }

  function chooseOption(label: string) {
    persist(current, label, question.isMarkedForReview);
  }

  function toggleMarkForReview() {
    persist(current, question.selectedOptionLabel, !question.isMarkedForReview);
  }

  function minutesSeconds(ms: number) {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function questionClass(index: number) {
    const q = questions[index];
    if (index === current) return "question-number current";
    if (q.isMarkedForReview) return "question-number marked";
    if (q.selectedOptionLabel != null) return "question-number answered";
    return "question-number";
  }

  if (confirming) {
    return (
      <main className="test-page">
        <header className="test-header">
          <span className="back-link">EXIT DISABLED DURING TEST</span>
          <div className="test-progress">{testName}</div>
          <div className="timer">{minutesSeconds(remainingMs)}</div>
        </header>
        <section className="test-intro" style={{ marginTop: "8vh" }}>
          <div className="panel-kicker">READY TO SUBMIT?</div>
          <h1 style={{ fontSize: "clamp(22px, 3vw, 30px)" }}>Review before you finish</h1>
          <div className="submit-confirm-stats">
            <div>
              <strong>{answeredCount}</strong>Answered
            </div>
            <div>
              <strong>{questions.length - answeredCount}</strong>Unanswered
            </div>
            <div>
              <strong>{markedCount}</strong>Marked for review
            </div>
          </div>
          <div className="submit-confirm-actions">
            <button className="secondary-button" type="button" onClick={() => setConfirming(false)}>
              Go back
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={pending}
              onClick={() => {
                submittedRef.current = true;
                startTransition(() => submitAttemptAction(attemptId));
              }}
            >
              {pending ? "Submitting…" : "Submit test"} <span>→</span>
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="test-page">
      <header className="test-header">
        <span className="back-link" style={{ opacity: 0.5 }}>
          {testName}
        </span>
        <div className="test-progress">
          QUESTION <strong>{current + 1}</strong> / {questions.length}
        </div>
        <div className="timer">{minutesSeconds(remainingMs)}</div>
      </header>
      <section className="runner-layout">
        <aside className="question-nav">
          <span className="panel-kicker">QUESTIONS</span>
          {questions.map((_, index) => (
            <button className={questionClass(index)} key={index} onClick={() => setCurrent(index)}>
              {index + 1}
            </button>
          ))}
        </aside>
        <section className="question-card">
          <span className="panel-kicker">QUESTION {current + 1}</span>
          <h1>{question.questionText}</h1>
          <div className="option-list">
            {question.options.map((option) => (
              <button
                className={question.selectedOptionLabel === option.label ? "option selected" : "option"}
                key={option.label}
                onClick={() => chooseOption(option.label)}
              >
                <span>{option.label}</span>
                {option.text}
              </button>
            ))}
          </div>
          <div className="runner-actions">
            <button className="text-button" disabled={current === 0} onClick={() => setCurrent((v) => v - 1)}>
              Previous
            </button>
            <button
              className={question.isMarkedForReview ? "mark-review-btn active" : "mark-review-btn"}
              type="button"
              onClick={toggleMarkForReview}
            >
              {question.isMarkedForReview ? "Marked for review" : "Mark for review"}
            </button>
            {current === questions.length - 1 ? (
              <button className="primary-button" onClick={() => setConfirming(true)}>
                Submit test <span>→</span>
              </button>
            ) : (
              <button className="primary-button" onClick={() => setCurrent((v) => v + 1)}>
                Save &amp; next <span>→</span>
              </button>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
