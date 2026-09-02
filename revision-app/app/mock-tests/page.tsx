"use client";

import { useState } from "react";

const questions = [
  {
    prompt: "Which account is prepared to find gross profit or gross loss?",
    options: ["Trading Account", "Balance Sheet", "Cash Book", "Trial Balance"],
    answer: 0,
  },
  {
    prompt: "Under the straight-line method, depreciation is calculated on:",
    options: ["Market value", "Original cost", "Scrap value only", "Book profit"],
    answer: 1,
  },
  {
    prompt: "A trial balance is primarily prepared to check the:",
    options: ["Profitability of a business", "Financial position", "Arithmetical accuracy of ledger posting", "Cash position"],
    answer: 2,
  },
];

export default function MockTestsPage() {
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Array<number | null>>([]);
  const [submitted, setSubmitted] = useState(false);

  const question = questions[current];
  const score = answers.reduce((total, answer, index) => total + (answer === questions[index]?.answer ? 1 : 0), 0);

  function chooseOption(option: number) {
    setSelected(option);
    setAnswers((existing) => {
      const next = [...existing];
      next[current] = option;
      return next;
    });
  }

  function moveNext() {
    if (current < questions.length - 1) {
      setCurrent((value) => value + 1);
      setSelected(answers[current + 1] ?? null);
    }
  }

  if (submitted) {
    return (
      <main className="test-page"><a className="back-link" href="/">← Back to dashboard</a><section className="result-card"><span className="panel-kicker">TEST COMPLETE</span><h1>{score} / {questions.length}</h1><p className="result-summary">You answered {score} correctly. Use the result to decide what deserves another revision.</p><div className="result-actions"><button className="primary-button" onClick={() => { setSubmitted(false); setStarted(false); setCurrent(0); setAnswers([]); setSelected(null); }}>Retake test</button><a className="outline-button" href="/">Return home</a></div></section></main>
    );
  }

  if (!started) {
    return (
      <main className="test-page"><a className="back-link" href="/">← Back to dashboard</a><section className="test-intro"><div className="panel-kicker">MOCK TEST 03</div><h1>Accounting fundamentals</h1><p>Short practice set · 3 questions · 6 minutes</p><div className="test-rules"><div><strong>+1</strong><span>correct answer</span></div><div><strong>0</strong><span>unanswered</span></div><div><strong>-0.25</strong><span>incorrect answer</span></div></div><button className="primary-button" onClick={() => setStarted(true)}>Start test <span>→</span></button></section></main>
    );
  }

  return (
    <main className="test-page"><header className="test-header"><a className="back-link" href="/">← Exit test</a><div className="test-progress">QUESTION <strong>{current + 1}</strong> / {questions.length}</div><div className="timer">05:42</div></header><section className="runner-layout"><aside className="question-nav"><span className="panel-kicker">QUESTIONS</span>{questions.map((_, index) => <button className={index === current ? "question-number current" : answers[index] !== undefined ? "question-number answered" : "question-number"} key={index} onClick={() => { setCurrent(index); setSelected(answers[index] ?? null); }}>{index + 1}</button>)}</aside><section className="question-card"><span className="panel-kicker">FINANCIAL ACCOUNTING</span><h1>{question.prompt}</h1><div className="option-list">{question.options.map((option, index) => <button className={selected === index ? "option selected" : "option"} key={option} onClick={() => chooseOption(index)}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}</div><div className="runner-actions"><button className="text-button" disabled={current === 0} onClick={() => { setCurrent((value) => value - 1); setSelected(answers[current - 1] ?? null); }}>Previous</button>{current === questions.length - 1 ? <button className="primary-button" onClick={() => setSubmitted(true)}>Submit test <span>→</span></button> : <button className="primary-button" onClick={moveNext}>Save & next <span>→</span></button>}</div></section></section></main>
  );
}