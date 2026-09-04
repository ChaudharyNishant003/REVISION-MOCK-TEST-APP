"use client";

import { useState, useTransition } from "react";

import { approveQuestionAction, rejectQuestionAction } from "@/lib/actions/questionReview";

type Question = {
  id: string;
  questionText: string;
  topicId: string | null;
  correctOptionId: string | null;
  options: { id: string; label: string; text: string }[];
  extractionMetadata: { aiConfidence: number | null; requiresReview: boolean } | null;
};

/**
 * Shared editable question form: used both for reviewing a freshly-extracted draft question
 * (app/question-bank/sets/[setId]) and for editing an already-approved one in place from the
 * Question Bank list — `onCancel` distinguishes the two (present only for in-place editing).
 */
export default function ReviewQuestionCard({
  question,
  topics,
  submitLabel = "Approve",
  pendingLabel = "Approving…",
  onCancel,
}: {
  question: Question;
  topics: { id: string; label: string }[];
  submitLabel?: string;
  pendingLabel?: string;
  onCancel?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [rejectPending, startRejectTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await approveQuestionAction(null, formData);
      if (result?.error) setError(result.error);
      else {
        setError(null);
        onCancel?.();
      }
    });
  }

  return (
    <div className="review-question-card">
      {question.extractionMetadata ? (
        <div className="review-question-meta">
          {question.extractionMetadata.aiConfidence != null ? (
            <span>AI confidence {Math.round(question.extractionMetadata.aiConfidence * 100)}%</span>
          ) : null}
          {question.extractionMetadata.requiresReview ? <span className="task-tone amber">flagged for review</span> : null}
        </div>
      ) : null}

      <form action={handleSubmit}>
        <input type="hidden" name="questionId" value={question.id} />
        {error ? <div className="form-error" style={{ marginBottom: "10px" }}>{error}</div> : null}

        <div className="field" style={{ marginBottom: "12px" }}>
          <label>Question text</label>
          <textarea name="questionText" defaultValue={question.questionText} required maxLength={2000} rows={2} />
        </div>

        <div className="field" style={{ marginBottom: "14px", maxWidth: "420px" }}>
          <label>Topic</label>
          <select name="topicId" defaultValue={question.topicId ?? ""}>
            <option value="">No topic</option>
            {topics.map((t) => (
              <option value={t.id} key={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Options — select the correct answer</label>
          {question.options.map((option) => (
            <label className="review-option-row" key={option.id}>
              <input
                type="radio"
                name="correctLabel"
                value={option.label}
                defaultChecked={option.id === question.correctOptionId}
                required
              />
              <input type="hidden" name="optionId" value={option.id} />
              <input type="hidden" name="optionLabel" value={option.label} />
              <span className="option-label">{option.label}</span>
              <input type="text" name="optionText" defaultValue={option.text} required maxLength={500} />
            </label>
          ))}
        </div>

        <div className="review-actions">
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="slot-remove danger"
              type="button"
              disabled={rejectPending}
              onClick={() => {
                if (confirm("Reject this question? It will be archived and won't appear in the question bank.")) {
                  startRejectTransition(async () => {
                    await rejectQuestionAction(question.id);
                    onCancel?.();
                  });
                }
              }}
            >
              Reject
            </button>
            {onCancel ? (
              <button className="slot-remove" type="button" onClick={onCancel}>
                Cancel
              </button>
            ) : null}
          </div>
          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? pendingLabel : submitLabel} <span>→</span>
          </button>
        </div>
      </form>
    </div>
  );
}
