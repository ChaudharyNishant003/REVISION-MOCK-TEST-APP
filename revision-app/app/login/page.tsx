"use client";

import { useActionState } from "react";
import Link from "next/link";

import { loginAction, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = null;

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">R</div>
        <h1>Welcome back</h1>
        <p className="auth-sub">Log in to see today&apos;s revision plan.</p>
        <form className="auth-form" action={formAction}>
          {state?.error ? <div className="form-error">{state.error}</div> : null}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? "Logging in…" : "Log in"} <span>→</span>
          </button>
        </form>
        <p className="auth-switch">
          New here? <Link href="/signup">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
