"use client";

import { useId, useState, useTransition } from "react";

import { updateTopicAction, deleteTopicAction } from "@/lib/actions/syllabus";

type Topic = {
  id: string;
  name: string;
  estimatedRevisionMinutes: number;
  difficulty: string;
  importance: string;
};

export default function TopicRow({ topic }: { topic: Topic }) {
  const [editing, setEditing] = useState(false);
  const fieldId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateTopicAction(null, formData);
      if (result?.error) setError(result.error);
      else {
        setError(null);
        setEditing(false);
      }
    });
  }

  if (editing) {
    return (
      <form className="inline-form" action={handleSubmit} style={{ padding: "8px 10px" }}>
        <input type="hidden" name="topicId" value={topic.id} />
        {error ? <div className="form-error" style={{ width: "100%" }}>{error}</div> : null}
        <div className="field">
          <label htmlFor={`${fieldId}-name`}>Topic</label>
          <input id={`${fieldId}-name`} name="name" type="text" defaultValue={topic.name} required autoFocus />
        </div>
        <div className="field" style={{ minWidth: "90px", flex: "0 0 90px" }}>
          <label htmlFor={`${fieldId}-estimatedRevisionMinutes`}>Minutes</label>
          <input id={`${fieldId}-estimatedRevisionMinutes`} name="estimatedRevisionMinutes" type="number" min={5} max={480} defaultValue={topic.estimatedRevisionMinutes} />
        </div>
        <div className="field" style={{ minWidth: "110px", flex: "0 0 110px" }}>
          <label htmlFor={`${fieldId}-difficulty`}>Difficulty</label>
          <select id={`${fieldId}-difficulty`} name="difficulty" defaultValue={topic.difficulty}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div className="field" style={{ minWidth: "110px", flex: "0 0 110px" }}>
          <label htmlFor={`${fieldId}-importance`}>Importance</label>
          <select id={`${fieldId}-importance`} name="importance" defaultValue={topic.importance}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <button className="secondary-button" type="submit" disabled={pending}>
          Save
        </button>
        <button className="slot-remove" type="button" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="syllabus-topic-row">
      <span>
        {topic.name}
        <span className="syllabus-topic-meta">
          {topic.estimatedRevisionMinutes} min · {topic.difficulty} · {topic.importance} importance
        </span>
      </span>
      <div className="row-actions">
        <button className="slot-remove" type="button" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          className="slot-remove danger"
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm(`Delete "${topic.name}"? This removes its revision history and schedule too.`)) {
              startTransition(() => deleteTopicAction(topic.id));
            }
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
