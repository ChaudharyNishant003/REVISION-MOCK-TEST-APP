"use client";

import { useActionState } from "react";

import { addAvailabilitySlotAction, type FormState } from "@/lib/actions/availability";

const initialState: FormState = null;
const DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export default function AvailabilityForm() {
  const [state, formAction, pending] = useActionState(addAvailabilitySlotAction, initialState);

  return (
    <form className="inline-form" action={formAction}>
      {state?.error ? <div className="form-error" style={{ width: "100%" }}>{state.error}</div> : null}
      <div className="field">
        <label htmlFor="dayOfWeek">Day</label>
        <select id="dayOfWeek" name="dayOfWeek" defaultValue={1} required>
          {DAYS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="startTime">Start</label>
        <input id="startTime" name="startTime" type="time" defaultValue="19:00" required />
      </div>
      <div className="field">
        <label htmlFor="endTime">End</label>
        <input id="endTime" name="endTime" type="time" defaultValue="22:00" required />
      </div>
      <button className="secondary-button" type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add slot"}
      </button>
    </form>
  );
}
