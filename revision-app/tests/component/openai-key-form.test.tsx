/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { mockSave, mockClear } = vi.hoisted(() => ({
  mockSave: vi.fn(),
  mockClear: vi.fn(),
}));

vi.mock("@/lib/actions/settings", () => ({
  saveOpenAiKeyAction: mockSave,
  clearOpenAiKeyAction: mockClear,
}));

const { default: OpenAiKeyForm } = await import("@/app/settings/openai-key-form");

/**
 * The key form must never render the real credential, and must not offer a
 * destructive Clear action when there is nothing to clear.
 */
describe("OpenAiKeyForm", () => {
  beforeEach(() => {
    mockSave.mockReset();
    mockClear.mockReset();
  });

  it("shows the masked key when one is saved, and never the full value", () => {
    render(<OpenAiKeyForm maskedKey="sk-••••••••1234" />);

    expect(screen.getByText("sk-••••••••1234")).toBeDefined();
    expect(screen.queryByText(/sk-proj-/)).toBeNull();
  });

  it("says no key is configured when none is saved", () => {
    render(<OpenAiKeyForm maskedKey={null} />);

    expect(screen.getByText(/No key configured/i)).toBeDefined();
  });

  it("disables Clear when there is nothing to clear", () => {
    render(<OpenAiKeyForm maskedKey={null} />);

    const clearButton = screen.getByRole("button", { name: /Clear key/i }) as HTMLButtonElement;
    expect(clearButton.disabled).toBe(true);
  });

  it("enables Clear once a key exists", () => {
    render(<OpenAiKeyForm maskedKey="sk-••••••••1234" />);

    const clearButton = screen.getByRole("button", { name: /Clear key/i }) as HTMLButtonElement;
    expect(clearButton.disabled).toBe(false);
  });

  it("offers an input for a new key with a helpful placeholder", () => {
    render(<OpenAiKeyForm maskedKey={null} />);

    const input = screen.getByLabelText(/New API key/i) as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.placeholder).toBe("sk-...");
    // Browsers must not autofill or spellcheck a credential field.
    expect(input.getAttribute("autocomplete")).toBe("off");
  });

  it("starts with an empty input so a saved key is never echoed back into the form", () => {
    render(<OpenAiKeyForm maskedKey="sk-••••••••1234" />);

    const input = screen.getByLabelText(/New API key/i) as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("tells the user where to get a key", () => {
    render(<OpenAiKeyForm maskedKey={null} />);

    const link = screen.getByRole("link", { name: /platform\.openai\.com/i }) as HTMLAnchorElement;
    expect(link.href).toContain("platform.openai.com/api-keys");
    // External link hygiene.
    expect(link.rel).toContain("noreferrer");
  });

  it("states that the key stays server-side", () => {
    render(<OpenAiKeyForm maskedKey={null} />);

    expect(screen.getByText(/never sent to your browser/i)).toBeDefined();
  });

  it("offers a save action", () => {
    render(<OpenAiKeyForm maskedKey={null} />);

    expect(screen.getByRole("button", { name: /Save key/i })).toBeDefined();
  });
});
