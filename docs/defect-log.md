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

## Summary

| Severity | Open | Fixed |
|---|---|---|
| Critical | 0 | 0 |
| High | 0 | 0 |
| Medium | 0 | 1 |
| Low | 0 | 1 |

_Last updated: Phase 2 (integration tests) complete — 199/199 passing across 15 files._
