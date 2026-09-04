"use client";

import { useState, useTransition } from "react";

import { updateChapterAction, deleteChapterAction } from "@/lib/actions/syllabus";

export default function ChapterHeader({ chapterId, name }: { chapterId: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateChapterAction(null, formData);
      if (result?.error) setError(result.error);
      else {
        setError(null);
        setEditing(false);
      }
    });
  }

  if (editing) {
    return (
      <div className="syllabus-row-head">
        <form className="syllabus-edit-form" action={handleSubmit}>
          <input type="hidden" name="chapterId" value={chapterId} />
          {error ? <div className="form-error">{error}</div> : null}
          <input type="text" name="name" defaultValue={name} required autoFocus />
          <button className="secondary-button" type="submit" disabled={pending}>
            Save
          </button>
          <button className="slot-remove" type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="syllabus-row-head">
      <h4>{name}</h4>
      <div className="row-actions">
        <button className="slot-remove" type="button" onClick={() => setEditing(true)}>
          Rename
        </button>
        <button
          className="slot-remove danger"
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm(`Delete "${name}" and every topic and revision task under it? This can't be undone.`)) {
              startTransition(() => deleteChapterAction(chapterId));
            }
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
