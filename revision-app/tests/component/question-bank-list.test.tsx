/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Server actions can't execute in jsdom, so the action module is mocked at the boundary.
const { mockReject, mockApprove } = vi.hoisted(() => ({
  mockReject: vi.fn(),
  mockApprove: vi.fn(),
}));

vi.mock("@/lib/actions/questionReview", () => ({
  rejectQuestionAction: mockReject,
  approveQuestionAction: mockApprove,
}));

const { default: QuestionBankList } = await import("@/app/question-bank/question-bank-list");

const questions = [
  {
    id: "q1",
    questionText: "Which account shows gross profit?",
    topicId: "t1",
    correctOptionId: "o1",
    questionSet: { id: "set1", name: "Accounting Set" },
    topic: { id: "t1", name: "Final Accounts", chapter: { subject: { name: "Financial Accounting" } } },
    options: [
      { id: "o1", label: "A", text: "Trading Account" },
      { id: "o2", label: "B", text: "Balance Sheet" },
    ],
    extractionMetadata: null,
  },
  {
    id: "q2",
    questionText: "Input tax credit cannot be claimed on?",
    topicId: "t2",
    correctOptionId: "o3",
    questionSet: { id: "set2", name: "Taxation Set" },
    topic: { id: "t2", name: "GST", chapter: { subject: { name: "Taxation" } } },
    options: [
      { id: "o3", label: "A", text: "Raw materials" },
      { id: "o4", label: "B", text: "Personal vehicles" },
    ],
    extractionMetadata: null,
  },
  {
    id: "q3",
    questionText: "Depreciation reflects which concept?",
    topicId: null,
    correctOptionId: "o5",
    questionSet: { id: "set1", name: "Accounting Set" },
    topic: null,
    options: [
      { id: "o5", label: "A", text: "Wear and tear" },
      { id: "o6", label: "B", text: "Appreciation" },
    ],
    extractionMetadata: null,
  },
];

const topics = [
  { id: "t1", label: "Financial Accounting · Final Accounts · Final Accounts" },
  { id: "t2", label: "Taxation · GST · GST" },
];

describe("QuestionBankList", () => {
  beforeEach(() => {
    mockReject.mockReset();
    mockApprove.mockReset();
  });

  it("lists every approved question", () => {
    render(<QuestionBankList questions={questions} topics={topics} />);

    expect(screen.getByText(/Which account shows gross profit/)).toBeDefined();
    expect(screen.getByText(/Input tax credit/)).toBeDefined();
    expect(screen.getByText(/Depreciation reflects/)).toBeDefined();
  });

  it("filters by free-text search", async () => {
    const user = userEvent.setup();
    render(<QuestionBankList questions={questions} topics={topics} />);

    await user.type(screen.getByPlaceholderText(/Filter by question text/i), "depreciation");

    expect(screen.getByText(/Depreciation reflects/)).toBeDefined();
    expect(screen.queryByText(/Which account shows gross profit/)).toBeNull();
    expect(screen.queryByText(/Input tax credit/)).toBeNull();
  });

  it("search is case-insensitive", async () => {
    const user = userEvent.setup();
    render(<QuestionBankList questions={questions} topics={topics} />);

    await user.type(screen.getByPlaceholderText(/Filter by question text/i), "GROSS PROFIT");

    expect(screen.getByText(/Which account shows gross profit/)).toBeDefined();
  });

  it("filters by question set", async () => {
    const user = userEvent.setup();
    render(<QuestionBankList questions={questions} topics={topics} />);

    await user.selectOptions(screen.getByLabelText(/Question set/i), "set2");

    expect(screen.getByText(/Input tax credit/)).toBeDefined();
    expect(screen.queryByText(/Which account shows gross profit/)).toBeNull();
    expect(screen.queryByText(/Depreciation reflects/)).toBeNull();
  });

  it("filters by topic", async () => {
    const user = userEvent.setup();
    render(<QuestionBankList questions={questions} topics={topics} />);

    await user.selectOptions(screen.getByLabelText(/^Topic$/i), "t1");

    expect(screen.getByText(/Which account shows gross profit/)).toBeDefined();
    expect(screen.queryByText(/Input tax credit/)).toBeNull();
  });

  it("combines filters rather than replacing them", async () => {
    const user = userEvent.setup();
    render(<QuestionBankList questions={questions} topics={topics} />);

    await user.selectOptions(screen.getByLabelText(/Question set/i), "set1");
    await user.type(screen.getByPlaceholderText(/Filter by question text/i), "depreciation");

    // Only the question matching BOTH the set and the search text survives.
    expect(screen.getByText(/Depreciation reflects/)).toBeDefined();
    expect(screen.queryByText(/Which account shows gross profit/)).toBeNull();
  });

  it("explains when filters match nothing, distinct from an empty bank", async () => {
    const user = userEvent.setup();
    render(<QuestionBankList questions={questions} topics={topics} />);

    await user.type(screen.getByPlaceholderText(/Filter by question text/i), "zzzznomatch");

    expect(screen.getByText(/No questions match these filters/i)).toBeDefined();
  });

  it("shows an onboarding hint when the bank is genuinely empty", () => {
    render(<QuestionBankList questions={[]} topics={topics} />);

    expect(screen.getByText(/Upload images containing MCQs to begin/i)).toBeDefined();
  });

  it("opens an inline editor when Edit is clicked, and closes it on Cancel", async () => {
    const user = userEvent.setup();
    render(<QuestionBankList questions={questions} topics={topics} />);

    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);

    // The edit form exposes the question text in an editable field.
    const textarea = screen.getByDisplayValue(/Which account shows gross profit/);
    expect(textarea).toBeDefined();
    expect(screen.getByRole("button", { name: /Save changes/i })).toBeDefined();

    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(screen.queryByRole("button", { name: /Save changes/i })).toBeNull();
  });

  it("edits only the question that was opened", async () => {
    const user = userEvent.setup();
    render(<QuestionBankList questions={questions} topics={topics} />);

    await user.click(screen.getAllByRole("button", { name: "Edit" })[1]);

    expect(screen.getByDisplayValue(/Input tax credit/)).toBeDefined();
    // The others stay as plain rows.
    expect(screen.getByText(/Which account shows gross profit/)).toBeDefined();
    expect(screen.getAllByRole("button", { name: /Save changes/i })).toHaveLength(1);
  });

  it("shows the option text as editable fields with the correct answer preselected", async () => {
    const user = userEvent.setup();
    render(<QuestionBankList questions={questions} topics={topics} />);

    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);

    expect(screen.getByDisplayValue("Trading Account")).toBeDefined();
    expect(screen.getByDisplayValue("Balance Sheet")).toBeDefined();

    // Option A is the stored correct answer (correctOptionId === "o1").
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios[0].checked).toBe(true);
    expect(radios[1].checked).toBe(false);
  });
});
