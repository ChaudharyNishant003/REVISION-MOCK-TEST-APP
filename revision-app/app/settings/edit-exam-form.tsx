"use client";

import { useActionState } from "react";

import { updateExamAction, type FormState } from "@/lib/actions/exam";

const initialState: FormState = null;

export default function EditExamForm({ name, examDate }: { name: string; examDate: string }) {
  const [state, formAction, pending] = useActionState(updateExamAction, initialState);

  return (
    <form className="auth-form" action={formAction}>
      {state?.error ? <div className="form-error">{state.error}</div> : null}
      <div className="field">
        <label htmlFor="name">Exam name</label>
        <input id="name" name="name" type="text" defaultValue={name} required />
      </div>
      <div className="field">
        <label htmlFor="examDate">Exam date</label>
        <input id="examDate" name="examDate" type="date" defaultValue={examDate} required />
      </div>
      <button className="secondary-button" type="submit" disabled={pending} style={{ justifySelf: "start" }}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
