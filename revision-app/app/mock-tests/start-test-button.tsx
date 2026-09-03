"use client";

import { useTransition } from "react";

import { startTestAttemptAction } from "@/lib/actions/mockTest";

export default function StartTestButton({ mockTestId }: { mockTestId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="primary-button"
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => startTestAttemptAction(mockTestId))}
    >
      {pending ? "Starting…" : "Start test"} <span>→</span>
    </button>
  );
}
