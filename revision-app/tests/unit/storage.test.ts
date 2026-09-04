import { describe, it, expect } from "vitest";

import { isAllowedImageType, isWithinSizeLimit } from "@/lib/ai/storage";

const TWELVE_MB = 12 * 1024 * 1024;

describe("isAllowedImageType", () => {
  it("accepts every supported photo format a phone camera or scanner produces", () => {
    expect(isAllowedImageType("image/jpeg")).toBe(true);
    expect(isAllowedImageType("image/png")).toBe(true);
    expect(isAllowedImageType("image/webp")).toBe(true);
    expect(isAllowedImageType("image/heic")).toBe(true); // iPhone default
    expect(isAllowedImageType("image/heif")).toBe(true);
  });

  it("rejects non-image and risky file types", () => {
    expect(isAllowedImageType("application/pdf")).toBe(false);
    expect(isAllowedImageType("text/html")).toBe(false);
    expect(isAllowedImageType("application/javascript")).toBe(false);
    // SVG can carry script, so it must not be accepted as an upload.
    expect(isAllowedImageType("image/svg+xml")).toBe(false);
  });

  it("rejects empty or malformed mime types", () => {
    expect(isAllowedImageType("")).toBe(false);
    expect(isAllowedImageType("image")).toBe(false);
    expect(isAllowedImageType("IMAGE/JPEG")).toBe(false); // exact-match set, case matters
  });
});

describe("isWithinSizeLimit", () => {
  it("accepts a normal photo size", () => {
    expect(isWithinSizeLimit(2 * 1024 * 1024)).toBe(true);
  });

  it("accepts exactly the 12MB limit but not a byte more", () => {
    expect(isWithinSizeLimit(TWELVE_MB)).toBe(true);
    expect(isWithinSizeLimit(TWELVE_MB + 1)).toBe(false);
  });

  it("rejects an empty file", () => {
    expect(isWithinSizeLimit(0)).toBe(false);
  });

  it("accepts the smallest non-empty file", () => {
    expect(isWithinSizeLimit(1)).toBe(true);
  });

  it("rejects a negative size", () => {
    expect(isWithinSizeLimit(-1)).toBe(false);
  });
});
