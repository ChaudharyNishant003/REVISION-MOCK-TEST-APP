"use client";

import { useActionState, useRef, useEffect, useId } from "react";

import { createTopicAction, type FormState } from "@/lib/actions/syllabus";

const initialState: FormState = null;

export default function AddTopicForm({ chapterId }: { chapterId: string }) {
  const [state, formAction, pending] = useActionState(createTopicAction, initialState);
  const fieldId = useId();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state?.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form className="inline-form" action={formAction} ref={formRef} style={{ marginTop: "8px" }}>
      <input type="hidden" name="chapterId" value={chapterId} />
      {state?.error ? <div className="form-error" style={{ width: "100%" }}>{state.error}</div> : null}
      <div className="field">
        <label htmlFor={`${fieldId}-name`}>Topic</label>
        <input id={`${fieldId}-name`} name="name" type="text" placeholder="Depreciation" required />
      </div>
      <div className="field" style={{ minWidth: "90px", flex: "0 0 90px" }}>
        <label htmlFor={`${fieldId}-estimatedRevisionMinutes`}>Minutes</label>
        <input id={`${fieldId}-estimatedRevisionMinutes`} name="estimatedRevisionMinutes" type="number" min={5} max={480} defaultValue={30} />
      </div>
      <div className="field" style={{ minWidth: "110px", flex: "0 0 110px" }}>
        <label htmlFor={`${fieldId}-difficulty`}>Difficulty</label>
        <select id={`${fieldId}-difficulty`} name="difficulty" defaultValue="medium">
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>
      <div className="field" style={{ minWidth: "110px", flex: "0 0 110px" }}>
        <label htmlFor={`${fieldId}-importance`}>Importance</label>
        <select id={`${fieldId}-importance`} name="importance" defaultValue="medium">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <button className="secondary-button" type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add topic"}
      </button>
    </form>
  );
}
