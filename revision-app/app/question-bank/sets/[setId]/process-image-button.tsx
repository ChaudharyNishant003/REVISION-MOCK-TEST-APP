"use client";

import { useTransition } from "react";

import { processImageAction } from "@/lib/actions/questionSet";

export default function ProcessImageButton({ imageId, status }: { imageId: string; status: string }) {
  const [pending, startTransition] = useTransition();

  if (status === "completed") return null;

  const label = pending || status === "processing" ? "Processing…" : status === "failed" ? "Retry" : "Process";

  return (
    <button
      className="start-button"
      type="button"
      disabled={pending || status === "processing"}
      onClick={() => startTransition(() => processImageAction(imageId))}
    >
      {label} <span>→</span>
    </button>
  );
}
