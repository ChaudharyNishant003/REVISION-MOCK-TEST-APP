"use client";

import { useActionState } from "react";

import { createExamAction, type FormState } from "@/lib/actions/exam";

const initialState: FormState = null;

export default function ExamSetupForm() {
  const [state, formAction, pending] = useActionState(createExamAction, initialState);

  return (
    <form className="auth-form" action={formAction}>
      {state?.error ? <div className="form-error">{state.error}</div> : null}
      <div className="field">
        <label htmlFor="name">Exam name</label>
        <input id="name" name="name" type="text" placeholder="Uttarakhand Accountant Examination" required />
      </div>
      <div className="field">
        <label htmlFor="examDate">Exam date</label>
        <input id="examDate" name="examDate" type="date" required />
      </div>
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Continue"} <span>→</span>
      </button>
    </form>
  );
}
