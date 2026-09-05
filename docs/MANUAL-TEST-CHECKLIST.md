# Manual Test Checklist

Everything that can be automated already is — 397 Vitest tests (unit, integration,
component, security), 26 Playwright E2E tests, 7 accessibility scans, and 7 performance
checks all run from `npm test` / `npm run test:e2e` and are wired into CI
(`.github/workflows/test.yml`). See `docs/defect-log.md` for what those runs have found.

This checklist is only for the handful of things that genuinely need a human, a real
browser, or a real OpenAI key to verify — nothing here is "extra credit," it's the actual
coverage gap left once automation has done everything it can.

---

## 1. AI question extraction with a real photo (needs your live OpenAI key)

**Why this can't be automated:** the integration tests (`tests/integration/questionPipeline.test.ts`)
mock the OpenAI call itself, proving the app correctly turns a *given* extraction response
into questions, topic matches, and correct-answer resolution. They cannot prove the AI
correctly *reads a real, possibly messy photograph* — that depends on real image quality,
handwriting, glare, and OpenAI's actual model output, none of which a mock can stand in for.

Check, using a real photo of a question (from a textbook or handwritten notes) and your own
API key saved in Settings:

- [ ] Upload a clear, well-lit photo of a single MCQ → all fields (question text, 4 options,
      correct answer, topic suggestion) come back reasonably accurate
- [ ] Upload a photo with 2-3 questions on one page → each is extracted as a separate draft
- [ ] Upload a deliberately poor photo (blurry, glare, or at an angle) → the app fails
      gracefully (a clear error or a low-confidence draft you can edit), not a crash or a
      silently wrong question
- [ ] The suggested topic actually matches one of your real syllabus topics when the subject
      matter is unambiguous
- [ ] Try it 3-5 times across different questions — reading extracted text against the
      original photo each time, since accuracy on real handwriting/print varies more than
      any single test can show

## 2. The disclosed logout flake (DEFECT-005)

**Why this can't be automated further:** investigated exhaustively — server behavior is
proven correct via raw `curl` (clean cookie clear, clean 307 redirect every time) — but an
intermittent client-side timing issue still shows up in ~2 of 5 full-suite Playwright runs
and never in isolation. See `docs/defect-log.md` for the full investigation.

- [ ] Log in, then log out, at least 5 times in a real browser session (not back-to-back
      automated clicks — normal human pace) → each time you should land on `/login` and stay
      there when you reload or navigate to `/`
- [ ] If you ever see the dashboard flash or reappear after clicking "Log out," note what you
      were doing right before it (which page, how fast you clicked) and report it — that's
      exactly the missing piece the automated investigation couldn't capture

## 3. Small-screen / mobile layout

**Why this can't be automated:** `app/globals.css` has a dedicated `@media (max-width: 620px)`
layout (collapsed sidebar into a horizontal scroll strip, hidden secondary columns, smaller
type), but every Playwright test runs at a fixed desktop viewport — this whole code path has
never been exercised by any test in this program, automated or otherwise.

On a phone, or a resized desktop browser window under ~620px wide:

- [ ] Dashboard, Revision, Question Bank, Mock Tests, Analytics, Settings all remain usable —
      nothing overlaps, clips, or requires horizontal scrolling of the whole page
- [ ] The sidebar's horizontal nav strip is reachable and each link still works
- [ ] Starting and completing a mock test attempt works on a touch screen (tapping options,
      "Save & Next," submitting)
- [ ] The login/signup forms are usable one-handed on a phone

## 4. Screen reader spot-check

**Why this can't be automated:** the axe-core scans (`tests/e2e-and-a11y/a11y/`) catch every
*automatically detectable* WCAG violation — contrast, missing labels, unassociated form
controls — but they can't verify that a real screen reader announces the page in an order
and manner that actually makes sense to a blind user. That's a judgment call, not a rule
check.

Using Windows Narrator (Ctrl+Win+Enter) or NVDA (free) on the Dashboard, a mock test attempt,
and the Settings page:

- [ ] Tabbing through the page reaches every interactive element in a sensible order
- [ ] Every button/link announces what it does, not just "button" or "link"
- [ ] The mock-test timer and question count are announced or at least discoverable, not only
      visible

## 5. Real deployment smoke test (only when you actually deploy somewhere)

**Why this can't be automated here:** DEFECT-004 (`trustHost`) was found and fixed by running
a real production build (`next start`) locally — that proves production *mode* works, but
not a real *deployment* (a different host, HTTPS, a process manager restarting the app,
environment variables set through a hosting provider's dashboard instead of a `.env` file).

Once you deploy this anywhere (Vercel, Railway, a VPS, etc.):

- [ ] Sign up, log in, log out all work over the real public URL
- [ ] Environment variables (`DATABASE_URL`, `AUTH_SECRET`, and optionally `OPENAI_API_KEY`)
      are set through that platform's own mechanism, not committed anywhere
- [ ] The SQLite database file survives a redeploy/restart (or you've deliberately moved to a
      hosted database — SQLite's single-file model doesn't survive most platforms' ephemeral
      filesystems across deploys)
