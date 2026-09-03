"use client";

import { useActionState, useRef, useEffect } from "react";

import { createSubjectAction, type FormState } from "@/lib/actions/syllabus";

const initialState: FormState = null;

export default function AddSubjectForm() {
  const [state, formAction, pending] = useActionState(createSubjectAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state?.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form className="inline-form" action={formAction} ref={formRef} style={{ marginBottom: "18px" }}>
      {state?.error ? <div className="form-error" style={{ width: "100%" }}>{state.error}</div> : null}
      <div className="field">
        <label htmlFor="subject-name">New subject</label>
        <input id="subject-name" name="name" type="text" placeholder="Accounting" required />
      </div>
      <button className="secondary-button" type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add subject"}
      </button>
    </form>
  );
}
