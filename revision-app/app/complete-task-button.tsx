"use client";

import { useState, useTransition } from "react";

import { completeRevisionTaskAction } from "@/lib/actions/revision";

type Confidence = "strong" | "okay" | "weak";

export default function CompleteTaskButton({ taskId }: { taskId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(confidence?: Confidence) {
    const formData = new FormData();
    formData.set("taskId", taskId);
    if (confidence) formData.set("confidence", confidence);
    startTransition(async () => {
      await completeRevisionTaskAction(null, formData);
    });
  }

  if (!expanded) {
    return (
      <button className="start-button" type="button" disabled={pending} onClick={() => setExpanded(true)}>
        Complete <span>→</span>
      </button>
    );
  }

  return (
    <div className="confidence-row" style={{ marginTop: 0 }}>
      <button className="confidence-btn weak" type="button" disabled={pending} onClick={() => submit("weak")}>
        Weak
      </button>
      <button className="confidence-btn" type="button" disabled={pending} onClick={() => submit("okay")}>
        Okay
      </button>
      <button className="confidence-btn strong" type="button" disabled={pending} onClick={() => submit("strong")}>
        Strong
      </button>
    </div>
  );
}
