import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

/**
 * Static defense-in-depth: every server action that mutates data must call requireUserId()
 * somewhere in its body. This can't prove the *ownership chain* is correct (that's what
 * tests/integration/ownership.test.ts proves by actually reading data across two accounts),
 * but it catches the specific class of bug where an entire auth check was simply forgotten
 * on a new action — the kind of mistake that's easy to make while iterating quickly and
 * easy to miss in review.
 */
const ACTIONS_DIR = path.join(__dirname, "..", "..", "lib", "actions");

// signupAction and loginAction establish identity — they run before any session exists.
// clearOpenAiKeyAction/deleteAvailabilitySlotAction-style void actions still require it;
// only true pre-auth entry points are exempt.
const EXEMPT_FUNCTIONS = new Set(["signupAction", "loginAction", "signOutAction"]);

function extractExportedFunctions(source: string): { name: string; body: string }[] {
  const functions: { name: string; body: string }[] = [];
  const fnStarts = [...source.matchAll(/export async function (\w+)\s*\([^)]*\)[^{]*\{/g)];

  for (let i = 0; i < fnStarts.length; i++) {
    const start = fnStarts[i].index! + fnStarts[i][0].length;
    const end = fnStarts[i + 1] ? fnStarts[i + 1].index! : source.length;
    functions.push({ name: fnStarts[i][1], body: source.slice(start, end) });
  }
  return functions;
}

describe("Every mutating server action requires an authenticated session", () => {
  const files = readdirSync(ACTIONS_DIR).filter((f) => f.endsWith(".ts"));
  expect(files.length).toBeGreaterThan(0); // sanity check the scan itself isn't silently empty

  for (const file of files) {
    const source = readFileSync(path.join(ACTIONS_DIR, file), "utf8");
    const functions = extractExportedFunctions(source);

    for (const fn of functions) {
      if (EXEMPT_FUNCTIONS.has(fn.name)) continue;

      it(`${file} :: ${fn.name} calls requireUserId()`, () => {
        expect(fn.body).toContain("requireUserId()");
      });
    }
  }
});

describe("No raw SQL or injection surface", () => {
  const libDir = path.join(__dirname, "..", "..", "lib");

  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : entry.name.endsWith(".ts") ? [full] : [];
    });
  }

  const dangerousPatterns = [
    { name: "$queryRawUnsafe", pattern: /\$queryRawUnsafe/ },
    { name: "$executeRawUnsafe", pattern: /\$executeRawUnsafe/ },
    { name: "raw SQL template concatenation", pattern: /\$queryRaw\s*`[^`]*\$\{/ },
  ];

  for (const file of walk(libDir)) {
    const relative = path.relative(path.join(__dirname, "..", ".."), file);
    const source = readFileSync(file, "utf8");

    for (const { name, pattern } of dangerousPatterns) {
      it(`${relative} contains no ${name}`, () => {
        expect(pattern.test(source)).toBe(false);
      });
    }
  }
});

describe("No unescaped HTML injection surface", () => {
  const appDir = path.join(__dirname, "..", "..", "app");

  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : entry.name.endsWith(".tsx") ? [full] : [];
    });
  }

  for (const file of walk(appDir)) {
    const relative = path.relative(path.join(__dirname, "..", ".."), file);
    const source = readFileSync(file, "utf8");

    it(`${relative} does not use dangerouslySetInnerHTML`, () => {
      expect(source).not.toContain("dangerouslySetInnerHTML");
    });
  }
});
