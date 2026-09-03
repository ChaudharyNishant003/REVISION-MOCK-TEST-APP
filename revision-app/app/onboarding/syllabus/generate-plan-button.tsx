"use client";

import { useTransition } from "react";

import { generatePlanAndFinishAction } from "@/lib/actions/syllabus";

export default function GeneratePlanButton({ disabled }: { disabled?: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="primary-button"
      type="button"
      disabled={disabled || pending}
      onClick={() => startTransition(() => generatePlanAndFinishAction())}
    >
      {pending ? "Generating plan…" : "Generate revision plan"} <span>→</span>
    </button>
  );
}
