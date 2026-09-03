"use client";

import { useTransition } from "react";

import { deleteTopicAction } from "@/lib/actions/syllabus";

export default function DeleteTopicButton({ topicId }: { topicId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="slot-remove"
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => deleteTopicAction(topicId))}
    >
      Remove
    </button>
  );
}
