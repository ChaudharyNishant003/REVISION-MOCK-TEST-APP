"use client";

import { useActionState, useTransition } from "react";

import { saveOpenAiKeyAction, clearOpenAiKeyAction, type FormState } from "@/lib/actions/settings";

const initialState: FormState = null;

export default function OpenAiKeyForm({ maskedKey }: { maskedKey: string | null }) {
  const [state, formAction, pending] = useActionState(saveOpenAiKeyAction, initialState);
  const [clearing, startClearTransition] = useTransition();

  return (
    <div>
      <p className="focus-note" style={{ maxWidth: "none", margin: "0 0 16px" }}>
        Get a key at{" "}
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
          platform.openai.com/api-keys
        </a>
        . Stored in the database and used only server-side — never sent to your browser.
      </p>
      <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 16px" }}>
        Current key: <strong>{maskedKey ?? "No key configured"}</strong>
      </p>

      <form className="auth-form" action={formAction}>
        {state?.error ? <div className="form-error">{state.error}</div> : null}
        <div className="field">
          <label htmlFor="apiKey">New API key (leave blank to keep current, or clear below)</label>
          <input id="apiKey" name="apiKey" type="text" placeholder="sk-..." autoComplete="off" spellCheck={false} />
        </div>
        <button className="secondary-button" type="submit" disabled={pending} style={{ justifySelf: "start" }}>
          {pending ? "Saving…" : "Save key"}
        </button>
      </form>

      <button
        className="slot-remove"
        type="button"
        disabled={clearing || !maskedKey}
        style={{ marginTop: "12px" }}
        onClick={() => {
          if (confirm("Clear your saved OpenAI API key? MCQ extraction will stop working until a new key is set.")) {
            startClearTransition(() => clearOpenAiKeyAction());
          }
        }}
      >
        {clearing ? "Clearing…" : "Clear key"}
      </button>
    </div>
  );
}
