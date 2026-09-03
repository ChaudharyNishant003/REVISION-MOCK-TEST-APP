"use client";

import { useActionState, useRef, useEffect } from "react";

import { createChapterAction, type FormState } from "@/lib/actions/syllabus";

const initialState: FormState = null;

export default function AddChapterForm({ subjectId }: { subjectId: string }) {
  const [state, formAction, pending] = useActionState(createChapterAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state?.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form className="inline-form" action={formAction} ref={formRef} style={{ marginTop: "8px" }}>
      <input type="hidden" name="subjectId" value={subjectId} />
      {state?.error ? <div className="form-error" style={{ width: "100%" }}>{state.error}</div> : null}
      <div className="field">
        <label>Add chapter</label>
        <input name="name" type="text" placeholder="Final Accounts" required />
      </div>
      <button className="secondary-button" type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
