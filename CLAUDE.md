# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

This repo root is a thin wrapper: the actual application ("Revision Room", an exam-prep spaced-repetition + mock-test app) lives entirely under [revision-app/](revision-app/). **Run all commands from `revision-app/`, not the repo root.**

- [revision-app/](revision-app/) — the Next.js app (see below).
- `REVISION + MOCK TEST APP.pdf` — the product spec. Numbered "Document NN §x" comments throughout the codebase (e.g. `Document 02 §5-8`, `Document 03 §13`) cite sections of this PDF as the source of truth for scheduling/scoring/AI-extraction behavior. When a comment cites a document/section you don't understand, check this PDF before assuming intent.
- Root-level `package.json`, `package-lock.json`, and `node_modules/` are stray/untracked (not part of the app, no `name`/`scripts`, just an `openai` dependency) — ignore them; the real dependency tree is [revision-app/package.json](revision-app/package.json).

## Commands

All run from `revision-app/`:

- `npm run dev` — start the dev server ([http://localhost:3000](http://localhost:3000))
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next`)
- No test framework is configured — there is no `test` script and no test files.

Database (Prisma 7, SQLite via `better-sqlite3`, config in [prisma.config.ts](revision-app/prisma.config.ts) rather than `package.json`):
- `npx prisma generate` — regenerate the client after schema changes
- `npx prisma migrate dev --name <name>` — create/apply a migration ([revision-app/prisma/migrations/](revision-app/prisma/migrations/))
- `npx prisma studio` — inspect the local DB
- `npx tsx prisma/seed.ts` — populate a full realistic account (`owner@example.com` / `Password123!`) with an exam, syllabus, a generated revision plan (some completed, some overdue), an approved question bank, and one submitted mock-test attempt. **Not** wired to `prisma db seed` — must be run directly.

Required env vars ([revision-app/.env](revision-app/.env), see [.env.example](revision-app/.env.example)): `DATABASE_URL`, `AUTH_SECRET`. `OPENAI_API_KEY` is optional — only needed to enable MCQ image-upload extraction; without it that one feature throws `OpenAIKeyMissingError` but the rest of the app works.

## Architecture

### Domain model

The Prisma schema ([revision-app/prisma/schema.prisma](revision-app/prisma/schema.prisma)) has two parallel trees hanging off `Exam`:

1. **Syllabus / scheduling**: `Subject → Chapter → Topic → RevisionTask → RevisionHistory`, plus `StudyAvailability` (weekly time slots) and `TopicPerformanceProfile` (rolling accuracy stats per topic).
2. **Questions / testing**: `QuestionSet → Question → QuestionOption`, `MockTest → MockTestQuestion`, and `TestAttempt → AttemptQuestion → AttemptAnswer`.

SQLite doesn't support Prisma enums, so every status/category field (`RevisionTask.status`, `Question.approvalStatus`, `Difficulty`, `Importance`, `Confidence`, etc.) is a plain `String` with allowed values documented as a schema comment and enforced by the zod schemas in [lib/validation.ts](revision-app/lib/validation.ts) — check both files together when touching one of these fields.

`AttemptQuestion`/`AttemptAnswer` are immutable snapshots taken when a test attempt starts (`questionTextSnapshot`, `optionsSnapshot`, `correctAnswerSnapshot`) — editing a `Question` later never changes the history of past attempts.

### Scheduler (`lib/scheduler/`) — deterministic, never touches AI

A spaced-repetition engine, explicitly separate from the AI extraction pipeline:
- [dates.ts](revision-app/lib/scheduler/dates.ts) — date-math helpers.
- [capacity.ts](revision-app/lib/scheduler/capacity.ts) — usable study minutes per day from `StudyAvailability`, at 85% of raw slot time (`CAPACITY_BUFFER_RATIO`) to leave buffer.
- [priority.ts](revision-app/lib/scheduler/priority.ts) — `calculatePriorityScore` (importance + difficulty + last confidence + days overdue + days since last revision + recent mock accuracy + a final-week boost for high-importance topics) and `nextRevisionGapDays` (base gap by revision number, narrowed/widened by confidence, capped by days left).
- [generatePlan.ts](revision-app/lib/scheduler/generatePlan.ts) — `generateInitialPlan` greedily places a Revision-1 task per topic (highest priority first) into the earliest day with spare capacity; no-ops if the exam already has tasks. `scheduleTopicIntoPlan` places one newly-added topic without disturbing the rest of the plan.
- [completeRevision.ts](revision-app/lib/scheduler/completeRevision.ts) — `completeRevisionTask` marks a task done, writes `RevisionHistory`, and schedules that topic's *next* revision further out — it never touches other tasks.
- [reprioritize.ts](revision-app/lib/scheduler/reprioritize.ts) — `reprioritizeTopic` re-scores a topic's still-open tasks after new performance data arrives; it adjusts `priorityScore` only, never `scheduledDate`, so one test result can't silently rebuild the plan.
- [dailyTasks.ts](revision-app/lib/scheduler/dailyTasks.ts) — `syncOverdueTasks` flips past-due `scheduled` tasks to `overdue`, `getTodaysTasks`/`getRevisionProgressSummary` are what the dashboard/revision pages read.

The consistent rule across this module: individual completions/results nudge priority and schedule the *next* item, but nothing ever does a global replan except `generateInitialPlan` on a fresh exam.

### Mock tests (`lib/actions/mockTest.ts`, `lib/analytics/updateTopicPerformance.ts`)

- `startTestAttemptAction` snapshots the test's questions/options into `AttemptQuestion`/`AttemptAnswer` rows at start time.
- `saveAnswerAction`/`addTimeSpentAction` update the in-progress attempt (answer-change counts, capped per-tick time deltas).
- `submitAttemptAction` does deterministic scoring only (correct×marksPerCorrect − incorrect×negativeMarksPerIncorrect), then calls `updateTopicPerformanceForAttempt`.
- `updateTopicPerformanceForAttempt` recomputes each affected topic's `TopicPerformanceProfile` from *all* of that user's submitted attempts (not just the new one) — a topic needs `MIN_QUESTIONS_FOR_A_VERDICT` (3) attempted questions before it gets a real `attentionLevel` instead of `"limited_data"`, and a trend label needs 2× that. It finishes by calling `reprioritizeTopic`, which is how mock-test results feed back into the revision scheduler.
- [lib/mockTests/seedDemo.ts](revision-app/lib/mockTests/seedDemo.ts) — `ensureDemoMockTest` auto-creates one tiny approved question set + ready mock test the first time a user reaches their dashboard, so the test-taking loop works before they've uploaded/approved any real questions.

### AI question extraction (`lib/ai/`)

Fully separate from the scheduler/scoring logic above — AI only *extracts*, it never decides topic mapping, approval, or the confirmed correct answer (those stay human-driven, tracked via `Question.approvalStatus` / `correctOptionId`).
- [extraction.ts](revision-app/lib/ai/extraction.ts) — sends an uploaded image to OpenAI (`OPENAI_MODEL` env var, default `gpt-4o-mini`) with a strict JSON-schema response format; returns one or more `ExtractedQuestion`s per image, each carrying its own `confidence` and an `incomplete` flag rather than ever guessing at unreadable content.
- [storage.ts](revision-app/lib/ai/storage.ts) — uploaded images are saved to `revision-app/data/question-images/<questionSetId>/` (gitignored, outside `public/`, resolved relative to `process.cwd()`), never served directly.
- `AiProcessingJob` / `QuestionExtractionMetadata` (schema) track extraction job status and per-question AI confidence separately from the question data itself.

### Auth & routing

- NextAuth v5 (beta), JWT sessions, `Credentials` provider with bcrypt ([auth.ts](revision-app/auth.ts)).
- Route protection is layered: [proxy.ts](revision-app/proxy.ts) — **this is Next.js's renamed `middleware.ts`** (Next 16 breaking change; see `<!-- BEGIN:nextjs-agent-rules -->` in [AGENTS.md](revision-app/AGENTS.md) and `node_modules/next/dist/docs/` before assuming any other Next.js API works the way you remember) — redirects unauthenticated requests to `/login` and authenticated requests away from `/login`/`/signup`. On top of that, [lib/session.ts](revision-app/lib/session.ts)'s `requireUserId()` is called again inside server actions/data loaders as a second guard.
- Every server action/data loader also re-checks record ownership against `requireUserId()` (e.g. `mockTest.exam.userId !== userId`) — the middleware only proves *a* user is logged in, not that they own the resource being touched.

### App structure

- `lib/actions/*.ts` — Next.js Server Actions (`"use server"`), one file per domain: `auth`, `availability`, `exam`, `mockTest`, `mockTestConfig`, `revision`, `syllabus`.
- `lib/data/*.ts` — read-only server-side data loaders consumed by pages (`exam`, `mockTests`, `mockTestAttempt`, `revisionOverview`, `analytics`).
- `app/` (App Router) — dashboard (`page.tsx`), `onboarding/{exam,availability,syllabus}` (first-run setup flow, in that order), `revision/`, `mock-tests/` (+ `[attemptId]` for an in-progress/completed attempt, `new` for building a test), `question-bank/`, `analytics/`, `settings/`, `login/`, `signup/`.
- Styling is Tailwind v4 (`@tailwindcss/postcss`) imported once in [app/globals.css](revision-app/app/globals.css), but the app is built almost entirely with hand-written semantic classes there (`.sidebar`, `.task-row`, `.panel`, etc.) rather than inline Tailwind utility classes — match that pattern (add/extend a semantic class in `globals.css`) rather than reaching for utility classes in JSX.
