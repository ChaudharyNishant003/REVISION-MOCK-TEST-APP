# Defect Log — Revision Room

Severity rubric (judged by "can this mislead the user or lose their data?"):

- **Critical** — produces a wrong number the user acts on (score, accuracy, priority, attention level), loses/corrupts data, or leaks data across accounts
- **High** — a core flow is blocked, or a specified behavior is missing entirely
- **Medium** — works but behaves surprisingly; a workaround exists
- **Low** — cosmetic, copy, robustness hardening

---

## DEFECT-001 — AES-GCM auth tag length not pinned on decryption

| Field | Detail |
|---|---|
| **Severity** | Low |
| **Module** | Settings / crypto (`lib/crypto.ts`) |
| **Found by** | `tests/unit/crypto.test.ts` (Phase 1 unit run) |
| **Expected** | Decrypting a malformed value fails cleanly with no runtime warnings |
| **Actual** | Node emitted `DeprecationWarning: Using AES-GCM authentication tags of less than 128 bits without specifying the authTagLength option`. Triggered by the negative test cases feeding malformed ciphertext. |
| **Root cause** | `createDecipheriv` was called without an explicit `authTagLength`, so a truncated value could supply a short (weakened) authentication tag instead of being rejected outright. |
| **Impact** | No production impact found — valid ciphertext always carries a full 16-byte tag. This is defense-in-depth against a tampered/truncated stored value. |
| **Fix** | Pass `{ authTagLength: TAG_LENGTH }` to `createDecipheriv`. |
| **Status** | ✅ Fixed — verified by re-running `tests/unit/crypto.test.ts` (8/8 pass, warning gone) |

---

## DEFECT-002 — Performance trend never appeared for 6–10 answered questions

| Field | Detail |
|---|---|
| **Severity** | Medium |
| **Module** | Analytics (`lib/analytics/updateTopicPerformance.ts`) |
| **Found by** | `tests/integration/analytics.test.ts` (Phase 2 integration run) |
| **Expected** | Per the code's own guard (`attempted.length >= MIN_QUESTIONS_FOR_A_VERDICT * 2`, i.e. 6), a topic with 6 or more answered questions should show an improving/declining/stable trend. |
| **Actual** | No trend ever appeared until a topic had **more than 10** answered questions. Verified: a topic with 8 answers returned `performanceTrend: null`. |
| **Root cause** | The older half was sliced as `attempted.slice(recent.length)`, where `recent.length` is `min(RECENT_WINDOW=10, attempted.length)`. With 6–10 answers the slice started at or past the end of the array, so the older half was always empty, `olderAccuracy` was `null`, and the trend was skipped — silently, since the guard suggested otherwise. |
| **Impact** | A candidate with 6–10 questions answered on a topic saw no trend indicator on the Analytics page and had no way to know whether they were improving on it. Not a wrong number, but a specified signal that silently never appeared. |
| **Fix** | Compare the newer half against the older half of whatever data exists (`midpoint = floor(attempted.length / 2)`) instead of slicing at the fixed 10-answer window. Both halves are now guaranteed non-empty at the guard's own threshold. |
| **Status** | ✅ Fixed — verified by 4 new trend tests (improving / declining / stable, plus a regression guard asserting a trend appears at exactly 6 answers) |

---

---

## DEFECT-003 — 19 form labels not associated with their inputs

| Field | Detail |
|---|---|
| **Severity** | Medium |
| **Module** | Syllabus Management, Question Review, Mock Test Creation (frontend) |
| **Found by** | `tests/component/question-bank-list.test.tsx` (Phase 3 component run) — `getByLabelText` failed to locate the "Question set" and "Topic" filter selects |
| **Expected** | Every `<label>` is associated with its control (`htmlFor`/`id`, or wraps it), so a screen reader announces what the field is for and clicking the label focuses the control. |
| **Actual** | 19 labels across 5 files were bare `<label>Text</label>` with no relationship to the adjacent input/select: `review-question-card.tsx` (3), `add-topic-form.tsx` (4), `topic-row.tsx` (4), `add-chapter-form.tsx` (1), `create-test-form.tsx` (7). A screen reader user could not tell which field "Minutes," "Difficulty," etc. referred to; clicking a label did nothing. |
| **Root cause** | Labels were written without `htmlFor` from the start; several of these components render multiple times per page (one row per topic/question), so a naive static `id` would have caused duplicate-id collisions across instances. |
| **Impact** | Accessibility — the app was usable visually but not with assistive technology across most of its data-entry surfaces. No data-correctness impact. |
| **Fix** | Added `useId()` per component instance and wired every label to its control via `htmlFor`/`id`; the radio group in the review card got a proper `<fieldset><legend>` instead of a floating label, since a label can't describe a group of inputs. |
| **Status** | ✅ Fixed — verified by the same component tests now passing via `getByLabelText`, and a repo-wide `grep` confirming zero remaining bare `<label>` tags. |

---

## DEFECT-004 — Login completely broken under production mode (`next start`) — no host is ever trusted

| Field | Detail |
|---|---|
| **Severity** | **Critical** |
| **Module** | Authentication (`auth.ts`) |
| **Found by** | Phase 4 E2E suite — every single browser-driven auth test failed identically the first time the app ran under `next start` instead of `next dev` |
| **Expected** | Logging in works the same way regardless of dev vs. production mode. |
| **Actual** | Every request to any `/api/auth/*` route returned 500 with `{"message":"There was a problem with the server configuration."}`. Server logs showed the real cause: `[auth][error] UntrustedHost: Host must be trusted. URL was: http://localhost:3100/api/auth/csrf`. **This is not specific to port 3100 or the test setup — it is Auth.js's documented production-mode behavior for any self-hosted deployment that doesn't declare a trusted host.** |
| **Root cause** | `auth.ts` never set `trustHost: true` (or `AUTH_URL`/`AUTH_TRUST_HOST`). Auth.js is lenient about this under `next dev`, which is why it was invisible all session — this app has never been run via `next start` (or any real production deployment) until the E2E harness did it for the first time. |
| **Impact** | **If this app were deployed anywhere and run in production mode (which is how essentially all hosting providers run a Next.js app — Vercel, Railway, Docker, a VPS via `next start`), no one would be able to log in, sign up, or do anything at all.** This was a ship-blocking defect that had been present since Module 1 was first built, entirely masked by always testing through `next dev`. |
| **Fix** | Added `trustHost: true` to the `NextAuth(...)` config in `auth.ts`, with a comment explaining why (self-hosted, no fixed `AUTH_URL`). |
| **Status** | ✅ Fixed — verified directly via `curl` before and after (500/UntrustedHost → clean 302 login + valid session), then by the full E2E suite passing end-to-end against a real production build. |

---

## DEFECT-005 — Intermittent logout-then-navigate flake under full-suite load (investigated, not a confirmed product bug)

| Field | Detail |
|---|---|
| **Severity** | Low (informational — see verdict) |
| **Module** | Authentication (E2E test only) |
| **Found by** | `01-auth.spec.ts`'s logout test, failing ~2 of 5 full-suite runs but never failing when run alone |
| **Symptom** | Occasionally, `page.goto("/")` immediately after a logout click still renders the authenticated dashboard instead of redirecting to `/login`. |
| **Investigation** | (1) Reproduced the exact sequence via raw `curl` with no browser involved: login → `POST /api/auth/signout` → confirmed `Set-Cookie: authjs.session-token=; Max-Age=0` → confirmed `GET /api/auth/session` returns `null` → confirmed `GET /` returns a clean `307` to `/login`. **Server behavior is unambiguously correct, every time.** (2) Added `expect.poll()` on the actual browser cookie jar to confirm the session cookie is gone before navigating again — this did not fully eliminate the flake. (3) A standalone diagnostic spec logging every request/response/cookie around logout passed cleanly and showed the outgoing request carrying no cookie and a correct 307 back. (4) The failure only appears when this test runs as part of the full 26-test, ~2-3 minute suite, never in isolation — consistent with this specific dev machine's Chromium instance experiencing scheduling/resource contention after many sequential navigations, not a deterministic protocol issue. |
| **Verdict** | No code-level cause could be identified despite exhausting the direct evidence available (HTTP-level proof, cookie-state polling, request/response tracing). Per this program's own rule (a flaky test gets investigated and disclosed, never silently retried into green — see `playwright.config.ts`'s `retries: 0`), this is logged openly rather than hidden. Added to the manual checklist for a human to spot-check logout a few times in a real browser, since that is the one form of evidence this investigation couldn't produce. |
| **Status** | 🟡 Open — informational. Not blocking, since the underlying server behavior is proven correct; flagged for awareness rather than fixed, because there is nothing in the code that has been shown to be wrong. |

---

## DEFECT-006 — Five text/background colour pairs fail WCAG AA contrast (4.5:1)

| Field | Detail |
|---|---|
| **Severity** | Medium |
| **Module** | Global styles (`app/globals.css`) — Dashboard, Revision, Question Bank, Mock Tests, Login |
| **Found by** | `tests/e2e-and-a11y/a11y/accessibility.spec.ts` (Phase 4 accessibility run, real axe-core scan against a production build) |
| **Expected** | Every text/background pair meets WCAG 2.1 AA's 4.5:1 minimum contrast ratio (the suite scans `wcag2a`/`wcag2aa` tags). |
| **Actual** | Six colour pairs measured below the threshold: the `--muted` grey `#73807b` on the app's cream/paper backgrounds (3.62–4.28:1), the sidebar's unscoped nav-item grey `#68746e` (4.28:1), the `--coral` accent used both as body text on light backgrounds and as a button background under white text (2.91–3.17:1), and the amber/coral "task-tone" status pills (`#a67b22` on `#fff1ce` at 3.41:1, `#c45440` on `#fbe8e1` at 3.78:1). Low-vision users could have struggled to read status pills, muted captions, and the login button's own label. |
| **Root cause** | The original palette was chosen for visual tone, not measured against WCAG's contrast formula — several accent/muted colours landed close to their backgrounds' luminance. |
| **Impact** | Accessibility only — no data-correctness or navigation impact; every affected string was still legible to typical vision, just below the AA standard for low-vision/screen-magnifier users. |
| **Fix** | Darkened each failing colour by the minimum amount needed to clear 4.5:1 against every background it actually appears on (computed programmatically, not eyeballed): `--muted` `#73807b`→`#646f6b`, `--coral` `#e56c55`→`#c1381e` (verified against all its usages: text on paper/cream/coral-soft backgrounds *and* as a button background under white text), the sidebar's hardcoded nav-item grey `#68746e`→`#646f6a`, and the two tone-pill text colours `#a67b22`→`#8b671d`, `#c45440`→`#b14937`. The `.mint` tone pill (`#39725c` on `#d7ebe0`, 4.51:1) already cleared the bar and was left untouched. |
| **Status** | ✅ Fixed — re-verified with a full production rebuild + re-run: 7/7 accessibility specs clean (all 6 authenticated pages plus the logged-out login page), with no regression in the 26-test E2E journey suite or the 7-test performance suite. |

---

## Observation (not a defect) — Mock Tests pages have no persistent sidebar

`/mock-tests`, the test runner, and the results page all use a separate `test-page` layout (just a "← Back to dashboard" link) instead of the `Sidebar` component every other page uses. For the live test *runner* this matches Document 10 §16's explicit "distraction-free" requirement — but it also applies to the plain test *list* and *results* pages, which aren't mid-exam and arguably could keep normal navigation. Noted here because an E2E test's own wrong assumption (that a sidebar existed there) is what surfaced it; left as-is rather than changed unprompted, since it may be a deliberate scope decision rather than an oversight.

---

## Summary

| Severity | Open | Fixed |
|---|---|---|
| Critical | 0 | 1 |
| High | 0 | 0 |
| Medium | 0 | 3 |
| Low | 1 | 1 |

_Last updated: Phase 4 (E2E, accessibility, performance, security) complete and re-verified against a production rebuild — 397/397 Vitest tests passing (unit + integration + component + security, including 168 security checks), 7/7 accessibility specs clean, 7/7 performance checks within budget, 25/26 E2E journey tests passing (the 1 failure is the disclosed DEFECT-005 flake, reproduced again under full-suite load exactly as documented — not a new issue)._
