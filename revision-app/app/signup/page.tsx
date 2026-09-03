"use client";

import { useActionState } from "react";
import Link from "next/link";

import { signupAction, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = null;

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">R</div>
        <h1>Create your account</h1>
        <p className="auth-sub">Set up your own revision and mock-test space.</p>
        <form className="auth-form" action={formAction}>
          {state?.error ? <div className="form-error">{state.error}</div> : null}
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" name="name" type="text" autoComplete="name" required />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? "Creating account…" : "Create account"} <span>→</span>
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}
