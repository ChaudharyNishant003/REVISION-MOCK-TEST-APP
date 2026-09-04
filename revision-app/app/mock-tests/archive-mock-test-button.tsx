"use client";

import { useTransition } from "react";

import { archiveMockTestAction } from "@/lib/actions/mockTestConfig";

export default function ArchiveMockTestButton({ mockTestId, name }: { mockTestId: string; name: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="slot-remove"
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(`Archive "${name}"? It won't be offered to sit again, but past attempts and results stay intact.`)) {
          startTransition(() => archiveMockTestAction(mockTestId));
        }
      }}
    >
      {pending ? "Archiving…" : "Archive"}
    </button>
  );
}
