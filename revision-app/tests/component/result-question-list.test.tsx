/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ResultQuestionList from "@/app/mock-tests/[attemptId]/result/result-question-list";

/**
 * The results screen is where a candidate reviews what they got wrong. If a filter
 * tab shows the wrong subset or a miscount, they'd study from a false picture.
 */
const items = [
  {
    id: "1",
    index: 1,
    questionText: "Which account shows gross profit?",
    status: "correct" as const,
    selectedLabel: "A",
    selectedText: "Trading Account",
    correctLabel: "A",
    correctText: "Trading Account",
  },
  {
    id: "2",
    index: 2,
    questionText: "Depreciation under WDV is charged on?",
    status: "incorrect" as const,
    selectedLabel: "C",
    selectedText: "Scrap value",
    correctLabel: "B",
    correctText: "Opening book value",
  },
  {
    id: "3",
    index: 3,
    questionText: "Margin of safety is the difference between?",
    status: "skipped" as const,
    selectedLabel: null,
    selectedText: null,
    correctLabel: "B",
    correctText: "Actual and break-even sales",
  },
  {
    id: "4",
    index: 4,
    questionText: "Break-even point is where contribution equals?",
    status: "incorrect" as const,
    selectedLabel: "A",
    selectedText: "Total variable cost",
    correctLabel: "B",
    correctText: "Total fixed cost",
  },
];

describe("ResultQuestionList", () => {
  it("shows every question by default", () => {
    render(<ResultQuestionList items={items} />);

    expect(screen.getByText(/Which account shows gross profit/)).toBeDefined();
    expect(screen.getByText(/Depreciation under WDV/)).toBeDefined();
    expect(screen.getByText(/Margin of safety/)).toBeDefined();
    expect(screen.getByText(/Break-even point/)).toBeDefined();
  });

  it("labels each tab with an accurate count", () => {
    render(<ResultQuestionList items={items} />);

    expect(screen.getByRole("button", { name: /All \(4\)/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Incorrect \(2\)/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Skipped \(1\)/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Correct \(1\)/ })).toBeDefined();
  });

  it("narrows to only incorrect answers", async () => {
    const user = userEvent.setup();
    render(<ResultQuestionList items={items} />);

    await user.click(screen.getByRole("button", { name: /Incorrect \(2\)/ }));

    expect(screen.getByText(/Depreciation under WDV/)).toBeDefined();
    expect(screen.getByText(/Break-even point/)).toBeDefined();
    expect(screen.queryByText(/Which account shows gross profit/)).toBeNull();
    expect(screen.queryByText(/Margin of safety/)).toBeNull();
  });

  it("narrows to only skipped questions", async () => {
    const user = userEvent.setup();
    render(<ResultQuestionList items={items} />);

    await user.click(screen.getByRole("button", { name: /Skipped \(1\)/ }));

    expect(screen.getByText(/Margin of safety/)).toBeDefined();
    expect(screen.queryByText(/Depreciation under WDV/)).toBeNull();
  });

  it("narrows to only correct answers", async () => {
    const user = userEvent.setup();
    render(<ResultQuestionList items={items} />);

    await user.click(screen.getByRole("button", { name: /Correct \(1\)/ }));

    expect(screen.getByText(/Which account shows gross profit/)).toBeDefined();
    expect(screen.queryByText(/Break-even point/)).toBeNull();
  });

  it("returns to the full list when All is reselected", async () => {
    const user = userEvent.setup();
    render(<ResultQuestionList items={items} />);

    await user.click(screen.getByRole("button", { name: /Skipped \(1\)/ }));
    await user.click(screen.getByRole("button", { name: /All \(4\)/ }));

    expect(screen.getByText(/Which account shows gross profit/)).toBeDefined();
    expect(screen.getByText(/Break-even point/)).toBeDefined();
  });

  it("shows what the candidate actually chose, and 'Not answered' when they skipped", () => {
    render(<ResultQuestionList items={items} />);

    expect(screen.getByText(/Your answer: C\. Scrap value/)).toBeDefined();
    expect(screen.getByText(/Your answer: Not answered/)).toBeDefined();
  });

  it("reveals the correct answer only for questions not already right", async () => {
    const user = userEvent.setup();
    render(<ResultQuestionList items={items} />);

    // On the correct-only tab there is nothing to correct, so no "correct answer" reveal row.
    await user.click(screen.getByRole("button", { name: /Correct \(1\)/ }));
    expect(screen.queryByText(/Opening book value/)).toBeNull();

    await user.click(screen.getByRole("button", { name: /Incorrect \(2\)/ }));
    expect(screen.getByText(/B\. Opening book value/)).toBeDefined();
  });

  it("explains an empty category rather than showing a blank panel", async () => {
    const user = userEvent.setup();
    render(<ResultQuestionList items={items.filter((i) => i.status !== "skipped")} />);

    await user.click(screen.getByRole("button", { name: /Skipped \(0\)/ }));

    expect(screen.getByText(/No questions in this category/i)).toBeDefined();
  });

  it("handles a perfect score with no incorrect or skipped questions", () => {
    render(<ResultQuestionList items={[items[0]]} />);

    expect(screen.getByRole("button", { name: /All \(1\)/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Incorrect \(0\)/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Correct \(1\)/ })).toBeDefined();
  });
});
