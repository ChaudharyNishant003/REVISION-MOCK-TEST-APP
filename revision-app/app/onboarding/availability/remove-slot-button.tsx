"use client";

import { useTransition } from "react";

import { deleteAvailabilitySlotAction } from "@/lib/actions/availability";

export default function RemoveSlotButton({ slotId }: { slotId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="slot-remove"
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => deleteAvailabilitySlotAction(slotId))}
    >
      Remove
    </button>
  );
}
