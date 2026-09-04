# Revision Room — Full Test Suite + 2-Pass UAT Regression

## Context

Last session shipped a large body of work (question upload → AI extraction → review pipeline, syllabus edit/delete, mock test creation/archiving, results filters, analytics, adaptive scheduling, encrypted per-user OpenAI key) and pushed it to GitHub. **The project currently has zero automated tests** — no framework, no `test` script, nothing. So this does two things at once:

1. **Build a permanent, committed automated test suite** (unit + integration + component) that survives this session and catches regressions forever.
2. **Run a 2-pass UAT regression cycle** on top of it: Pass 1 → fix every defect → push → full Pass 2 → report anything still open.

## Confirmed decisions

- **Goal: trust it with real exam prep.** This sets the severity rubric — a defect is Critical/High if it could *mislead* the user (wrong score, wrong revision priority, wrong analytics verdict) or *lose/corrupt* their data. Cosmetic issues are logged, not blocked on.
- **Full even coverage across all 16 modules** — not risk-weighted sampling. Every module gets real tests.
- **Committed suite** — Vitest in the repo, `npm test`, protecting every future change.
- **Manual checklist delivered** — a short, precise click-by-click list for the handful of items needing a real browser or live OpenAI key, so those gaps actually get closed by the user rather than silently assumed.
- **Push cadence** — per the earlier standing instruction, commit + push as each meaningful chunk completes (unit suite green → integration suite green → fixes), not one giant commit at the end.

## Part 1 — Automated test suite (new, committed to the repo)

### Framework: Vitest

Chosen over Jest: native ESM + TypeScript (no babel/SWC transform config), resolves this codebase's `@/*` path alias via `vite-tsconfig-paths`, and runs fast enough to be worth running on every change. Jest with Next.js needs materially more setup for the same result.

**New devDependencies**: `vitest`, `vite-tsconfig-paths`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`

**New scripts** in `revision-app/package.json`:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:integration": "vitest run tests/integration"
```

### Test database isolation (important — protects real data)

Integration tests must never touch `prisma/dev.db`, which holds the user's real account. `tests/setup/db.ts` points `DATABASE_URL` at a dedicated `prisma/test.db`, runs `prisma migrate deploy` against it in Vitest's `globalSetup`, and truncates all tables in `beforeEach`. The test DB is gitignored.

### Small refactor required to make two things unit-testable

Scoring and the answer-status state machine currently live *inside* `submitAttemptAction`/`saveAnswerAction` (server actions), which can't be invoked outside a request. Extract them as pure functions — behavior-identical, just moved:

- `lib/mockTests/scoring.ts` → `calculateAttemptScore(answers, marksPerCorrect, negativeMarksPerIncorrect)` returning `{correct, incorrect, skipped, attempted, score, accuracy}`
- `lib/mockTests/answerStatus.ts` → `resolveAnswerStatus(answered: boolean, isMarkedForReview: boolean)`

Both actions then call these instead of inlining the logic. This matches how `lib/scheduler/*` is already structured (logic separate from the action wrapper) and is the only production-code change this plan makes.

### Test file layout

**Unit — pure functions, no DB** (`tests/unit/`)

| File | Covers |
|---|---|
| `priority.test.ts` | `calculatePriorityScore` across every importance×difficulty combo, confidence weights, overdue escalation **and its +30 cap**, days-since-revision cap, mock-accuracy bands (<50 → +18, <70 → +8, ≥90 → −6), final-week boost/de-prioritization; `baseRevisionGapDays`; `nextRevisionGapDays` (strong widens, weak narrows, clamped to ≥1 and ≤ daysUntilExam−1) |
| `capacity.test.ts` | `rawMinutesForDate` (single slot, multiple slots same day, no slots, wrong day-of-week); `usableMinutesForDate` = raw × 0.85 exactly |
| `dates.test.ts` | `startOfDay`, `endOfDay`, `addDays`, `daysBetween`, `daysUntilExam` — including month/year boundary crossings |
| `validation.test.ts` | Every Zod schema (signup, login, examSetup, availabilitySlot, subject, chapter, topic, completeRevision, mockTest, questionSet, draftQuestion, openaiApiKey) — valid, invalid, and boundary values for each |
| `crypto.test.ts` | Round-trip; **tampered ciphertext fails the GCM auth tag**; wrong `AUTH_SECRET` fails to decrypt; missing `AUTH_SECRET` throws |
| `storage.test.ts` | `isAllowedImageType` (each allowed type + rejected types); `isWithinSizeLimit` at 0, 1, exactly 12MB, 12MB+1 |
| `scoring.test.ts` | `calculateAttemptScore` — the hand-verified case (3 correct/1 incorrect/1 skipped, +2/−0.5 → score 5.5, accuracy 75), all-skipped → accuracy 0 not NaN, negative-marking disabled (0), all-correct |
| `answerStatus.test.ts` | All four `resolveAnswerStatus` branches |

**Integration — real logic against the test DB** (`tests/integration/`)

| File | Covers |
|---|---|
| `scheduler.test.ts` | `generateInitialPlan` schedules every topic / respects capacity / is idempotent on re-run; `scheduleTopicIntoPlan` adds without disturbing existing tasks; `completeRevisionTask` writes history + schedules revision N+1 + skips when <1 day to exam; `syncOverdueTasks` flips past-due; `getTodaysTasks` ordering; `getRevisionProgressSummary` counts |
| `analytics.test.ts` | `updateTopicPerformanceForAttempt`: stays `limited_data` under 3 attempted; each attention band boundary (55/75/85); `performanceTrend` improving/declining/stable across the recent-vs-older split; `averageTimeSeconds` mean |
| `adaptive.test.ts` | `reprioritizeTopic` changes `priorityScore` after weak performance, **and never changes `scheduledDate` or task count** |
| `questionPipeline.test.ts` | Extracted questions land `needs_review` (never auto-approved); low-confidence flagged `requiresReview`; approve sets `correctOptionId` by label match; reject excludes from bank + from mock-test eligibility |
| `mockTest.test.ts` | Attempt snapshot immutability (edit the source question *after* starting → snapshot unchanged); full attempt → submit → score persisted correctly; archived test excluded from the ready list **while its attempt history stays intact** |
| `ownership.test.ts` | Cross-user isolation: user B's exam/questions/attempts never returned by `getCurrentUserExam`, `getExamOwnedByUser`, `getQuestionSetDetail`, `getAttemptForUser` when called as user A |
| `settings.test.ts` | Key store → `getMaskedOpenAiKey` masks correctly → `getDecryptedOpenAiKey` recovers → clear sets null; **raw DB value never contains the plaintext** |

**Component — client components with real logic** (`tests/component/`, jsdom)

| File | Covers |
|---|---|
| `question-bank-list.test.tsx` | Search/set/topic filtering narrows correctly; Edit toggles the inline form |
| `result-question-list.test.tsx` | All/Incorrect/Skipped/Correct tabs filter correctly with accurate counts |
| `openai-key-form.test.tsx` | Masked key renders; "No key configured" when null; Clear disabled with no key |

Server Components and Server Actions are deliberately **not** unit-tested — they can't render/execute outside a Next.js request. They're covered by the HTTP and CODE layers below instead.

## Part 2 — UAT acceptance suite (the 2-pass regression)

Everything the automated suite can't reach, plus acceptance-level verification of the whole product.

**Execution methods**, marked per case: **[UNIT]/[INT]/[COMP]** (automated, above) · **[HTTP]** authenticated `curl` against a running dev server, asserting status + rendered content · **[CODE]** source review of the server-action wrapper (form parsing, `requireUserId()`, ownership) — the only method available for that layer, and flagged honestly as the weakest evidence · **[MANUAL]** genuinely needs a human with a browser or a live OpenAI key.

### Acceptance cases by module

| ID | Title | Method | Priority |
|---|---|---|---|
| **Auth** ||||
| TC-AUTH-01..03 | Signup valid / duplicate email / weak password + bad email | UNIT+INT | Critical |
| TC-AUTH-04..05 | Login correct password accepted, wrong rejected (bcrypt) | INT | Critical |
| TC-AUTH-06 | Unauthenticated access to every protected route → 302 `/login` | HTTP | Critical |
| TC-AUTH-07 | Authenticated access to `/login` redirects away | HTTP | Medium |
| TC-AUTH-08 | Cross-user isolation across every scoped query | INT | Critical |
| TC-AUTH-09 | Logout clears session | MANUAL | Low |
| **Exam / Availability / Syllabus** ||||
| TC-EXAM-01..04 | Future date accepted, past rejected, empty name rejected, edit persists | UNIT+INT | Critical |
| TC-EXAM-05 | Dashboard countdown matches `daysUntilExam` | HTTP | Medium |
| TC-AVAIL-01..04 | Slot validation, capacity = raw × 0.85, multi-slot days, removal | UNIT+INT | Critical |
| TC-SYL-01..07 | Add/rename at all 3 levels; delete cascades topic→chapter→subject; new topic slots into an existing plan | INT | Critical |
| **Scheduler / Tracking** ||||
| TC-SCHED-01..06 | Plan generation, idempotency, priority formula, overdue cap, final-week boost, confidence gap | UNIT+INT | Critical |
| TC-TRACK-01..04 | Completion with each confidence, next revision scheduled, none near exam, overdue flip | INT | Critical |
| **Question pipeline** ||||
| TC-UPLOAD-01..05 | Type/size validation, independent per-image rows, no-file rejected | UNIT+INT+CODE | High |
| TC-EXTRACT-01..05 | No-key clean failure, retry resets state, never auto-approves, low-confidence flagged, per-user key beats env | INT+CODE | Critical |
| TC-EXTRACT-06 | Live OpenAI extraction against a real image | MANUAL | — |
| TC-REVIEW-01..04 | Approve with edits, approve-without-answer rejected, reject archives, cross-user blocked | INT+CODE | Critical |
| TC-BANK-01..04 | Approved-only listing, filters, in-place edit, archive | INT+COMP+HTTP | High |
| **Mock tests** ||||
| TC-MTC-01..04 | Approved-only creation, mixed set rejected, config boundaries, picker filters | UNIT+INT | Critical |
| TC-RUN-01..04 | Snapshot immutability, answer-status machine, change-count, 300s time cap | UNIT+INT | Critical |
| TC-RUN-05 | Timer is server-authoritative (`endsAt − now`, refresh-proof) | CODE | High |
| TC-RUN-06 | Live countdown + auto-submit in a browser | MANUAL | — |
| TC-RESULT-01..03 | Scoring formula, zero-attempted accuracy, count integrity | UNIT | Critical |
| TC-RESULT-04..05 | Filter tabs + topic-performance link | COMP+HTTP | Medium |
| **Analytics / Adaptive** ||||
| TC-ANALYTICS-01..06 | Progress counts, limited_data threshold, band boundaries, trend, average time, never-revised | INT | Critical |
| TC-ANALYTICS-07 | Accuracy sparkline renders last ≤10 attempts | HTTP | Low |
| TC-ADAPT-01..04 | Reprioritize fires, weak raises / strong lowers, never moves dates or task count | INT | Critical |
| **Settings** ||||
| TC-SET-01..08 | Exam/availability edit, crypto round-trip, no plaintext in DB, masking, blank-save no-op, invalid key rejected, clear, env fallback | UNIT+INT+CODE | Critical |
| TC-ARCH-01..02 | Archive excludes from ready list; attempt history intact | INT | High |
| **Cross-cutting** ||||
| TC-SEC-01 | Every mutating action calls `requireUserId()` + an ownership chain | CODE | Critical |
| TC-SEC-02 | No raw SQL / injection surface (Prisma parameterized only) | CODE | High |
| TC-SEC-03 | No `dangerouslySetInnerHTML` on user text | CODE | High |
| TC-E2E-01 | Full journey: signup → exam → availability → syllabus → plan → complete revision → upload/extract/review/approve → create test → attempt → submit → results → analytics → reprioritization, verified on every page | INT+HTTP | Critical |
| TC-REG-01 | Pass 1 vs Pass 2 produce identical outcomes; any divergence logged as a defect (non-determinism) | — | Critical |

## Defect log format & severity rubric

`DEFECT-N | Severity | Module | Test case | Expected | Actual | Root cause | Fix`

Severity is judged against "can I trust this for real exam prep?":

- **Critical** — produces a wrong number the user would act on (score, accuracy, priority, attention level), loses/corrupts data, or leaks data across accounts.
- **High** — a core flow is blocked or a spec'd behavior is missing entirely.
- **Medium** — works but behaves surprisingly; a workaround exists.
- **Low** — cosmetic, copy, or layout.

## Cadence

1. **Build** the Vitest suite + the two extracted pure-function modules; get `npm test` green locally.
2. **Static gate**: `tsc --noEmit`, `eslint`, `npm test`, `next build` — all clean.
3. **Pass 1**: full automated suite + [HTTP] sweep + [CODE] review; log every defect.
4. **Fix** every Critical/High defect (Medium/Low fixed if trivial, else logged).
5. **Push** — commit + push as each chunk lands (unit green → integration green → component green → fixes), per the standing push-per-module instruction.
6. **Pass 2**: complete re-run of everything (not just what failed) against a fresh test DB and fresh disposable accounts.
7. **Report**: defects fixed vs. still open, TC-REG-01 parity result, plus the manual checklist.

## Deliverables

1. Committed Vitest suite (`npm test`) — unit, integration, component.
2. Two extracted pure-function modules (`lib/mockTests/scoring.ts`, `lib/mockTests/answerStatus.ts`) — the only production-code change, made purely for testability.
3. Fixes for every defect found.
4. **Manual test checklist** — a short click-by-click list covering the browser-only and live-OpenAI-key items, written so it takes ~10 minutes to run.
5. Final regression report: defects fixed vs. open, pass-1/pass-2 parity, residual risk stated plainly.

## Exit criteria

Zero open Critical/High defects after Pass 2, `npm test` green, build clean. Any open Medium/Low defects and every manual-checklist item reported explicitly rather than implied as passing.
