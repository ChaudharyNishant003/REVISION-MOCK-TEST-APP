"use client";

import { useActionState, useState } from "react";

import { uploadQuestionSetAction, type FormState } from "@/lib/actions/questionSet";

const initialState: FormState = null;

export default function UploadForm({ topics }: { topics: { id: string; label: string }[] }) {
  const [state, formAction, pending] = useActionState(uploadQuestionSetAction, initialState);
  const [fileNames, setFileNames] = useState<string[]>([]);

  return (
    <form action={formAction} className="inline-form" style={{ flexDirection: "column", alignItems: "stretch" }}>
      {state?.error ? <div className="form-error">{state.error}</div> : null}

      <div className="field">
        <label htmlFor="set-name">Question set name</label>
        <input id="set-name" name="name" type="text" placeholder="Accounting Practice Set 02" required maxLength={120} />
      </div>

      <div className="field">
        <label htmlFor="set-topic">Topic (optional)</label>
        <select id="set-topic" name="topicId" defaultValue="">
          <option value="">No specific topic — let AI suggest one per question</option>
          {topics.map((t) => (
            <option value={t.id} key={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="set-images">MCQ images</label>
        <input
          id="set-images"
          name="images"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          required
          onChange={(e) => setFileNames(Array.from(e.target.files ?? []).map((f) => f.name))}
        />
        {fileNames.length > 0 ? (
          <span className="focus-note" style={{ margin: 0, maxWidth: "none" }}>
            {fileNames.length} file{fileNames.length === 1 ? "" : "s"} selected: {fileNames.join(", ")}
          </span>
        ) : null}
      </div>

      <button className="primary-button" type="submit" disabled={pending} style={{ marginTop: "6px" }}>
        {pending ? "Uploading…" : "Upload & continue"} <span>→</span>
      </button>
    </form>
  );
}
