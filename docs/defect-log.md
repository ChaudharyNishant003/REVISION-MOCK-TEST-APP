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

## Summary

| Severity | Open | Fixed |
|---|---|---|
| Critical | 0 | 0 |
| High | 0 | 0 |
| Medium | 0 | 0 |
| Low | 0 | 1 |

_Last updated: Phase 1 (unit tests) complete — 111/111 passing._
