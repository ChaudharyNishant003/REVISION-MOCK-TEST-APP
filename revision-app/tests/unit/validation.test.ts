import { describe, it, expect } from "vitest";

import {
  signupSchema,
  loginSchema,
  examSetupSchema,
  availabilitySlotSchema,
  subjectSchema,
  chapterSchema,
  topicSchema,
  completeRevisionSchema,
  mockTestSchema,
  questionSetSchema,
  draftQuestionSchema,
  openaiApiKeySchema,
} from "@/lib/validation";

/**
 * Validation is the app's outer boundary. Every schema is checked for what it accepts,
 * what it rejects, and how it behaves exactly at the boundary values.
 */
describe("signupSchema", () => {
  it("accepts a valid signup and normalizes the email", () => {
    const result = signupSchema.safeParse({ name: "  Nishant  ", email: "  USER@Example.COM ", password: "password123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Nishant"); // trimmed
      expect(result.data.email).toBe("user@example.com"); // trimmed + lowercased
    }
  });

  it("rejects an empty name and an over-long one", () => {
    expect(signupSchema.safeParse({ name: "", email: "a@b.com", password: "password123" }).success).toBe(false);
    expect(signupSchema.safeParse({ name: "x".repeat(81), email: "a@b.com", password: "password123" }).success).toBe(false);
  });

  it("rejects an invalid email format", () => {
    expect(signupSchema.safeParse({ name: "A", email: "not-an-email", password: "password123" }).success).toBe(false);
  });

  it("enforces the 8-character minimum password exactly at the boundary", () => {
    expect(signupSchema.safeParse({ name: "A", email: "a@b.com", password: "1234567" }).success).toBe(false);
    expect(signupSchema.safeParse({ name: "A", email: "a@b.com", password: "12345678" }).success).toBe(true);
  });
});

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("examSetupSchema", () => {
  const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

  it("accepts a future exam date", () => {
    expect(examSetupSchema.safeParse({ name: "UK Accountant Exam", examDate: future.toISOString() }).success).toBe(true);
  });

  it("rejects an exam date in the past — the whole scheduler depends on runway existing", () => {
    expect(examSetupSchema.safeParse({ name: "Exam", examDate: past.toISOString() }).success).toBe(false);
  });

  it("rejects an empty or over-long name", () => {
    expect(examSetupSchema.safeParse({ name: "", examDate: future.toISOString() }).success).toBe(false);
    expect(examSetupSchema.safeParse({ name: "x".repeat(121), examDate: future.toISOString() }).success).toBe(false);
  });
});

describe("availabilitySlotSchema", () => {
  it("accepts a valid slot", () => {
    expect(availabilitySlotSchema.safeParse({ dayOfWeek: 1, startTime: "19:00", endTime: "21:00" }).success).toBe(true);
  });

  it("accepts both ends of the weekday range", () => {
    expect(availabilitySlotSchema.safeParse({ dayOfWeek: 0, startTime: "09:00", endTime: "10:00" }).success).toBe(true);
    expect(availabilitySlotSchema.safeParse({ dayOfWeek: 6, startTime: "09:00", endTime: "10:00" }).success).toBe(true);
  });

  it("rejects a day-of-week outside 0-6", () => {
    expect(availabilitySlotSchema.safeParse({ dayOfWeek: 7, startTime: "09:00", endTime: "10:00" }).success).toBe(false);
    expect(availabilitySlotSchema.safeParse({ dayOfWeek: -1, startTime: "09:00", endTime: "10:00" }).success).toBe(false);
  });

  it("rejects an end time at or before the start time", () => {
    expect(availabilitySlotSchema.safeParse({ dayOfWeek: 1, startTime: "21:00", endTime: "19:00" }).success).toBe(false);
    expect(availabilitySlotSchema.safeParse({ dayOfWeek: 1, startTime: "19:00", endTime: "19:00" }).success).toBe(false);
  });

  it("rejects malformed or out-of-range clock times", () => {
    expect(availabilitySlotSchema.safeParse({ dayOfWeek: 1, startTime: "7pm", endTime: "9pm" }).success).toBe(false);
    expect(availabilitySlotSchema.safeParse({ dayOfWeek: 1, startTime: "24:00", endTime: "25:00" }).success).toBe(false);
    expect(availabilitySlotSchema.safeParse({ dayOfWeek: 1, startTime: "19:60", endTime: "21:00" }).success).toBe(false);
  });
});

describe("subjectSchema / chapterSchema", () => {
  it("accepts valid names and trims them", () => {
    const subject = subjectSchema.safeParse({ name: "  Accounting  " });
    expect(subject.success).toBe(true);
    if (subject.success) expect(subject.data.name).toBe("Accounting");

    expect(chapterSchema.safeParse({ subjectId: "sub-1", name: "Depreciation" }).success).toBe(true);
  });

  it("rejects blank names, including whitespace-only", () => {
    expect(subjectSchema.safeParse({ name: "" }).success).toBe(false);
    expect(subjectSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(chapterSchema.safeParse({ subjectId: "sub-1", name: "  " }).success).toBe(false);
  });

  it("rejects a chapter with no parent subject", () => {
    expect(chapterSchema.safeParse({ subjectId: "", name: "Depreciation" }).success).toBe(false);
  });
});

describe("topicSchema", () => {
  const valid = { chapterId: "ch-1", name: "Straight Line Method" };

  it("applies documented defaults when optional fields are omitted", () => {
    const result = topicSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.estimatedRevisionMinutes).toBe(30);
      expect(result.data.difficulty).toBe("medium");
      expect(result.data.importance).toBe("medium");
    }
  });

  it("coerces numeric strings coming from form data", () => {
    const result = topicSchema.safeParse({ ...valid, estimatedRevisionMinutes: "45" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.estimatedRevisionMinutes).toBe(45);
  });

  it("enforces the 5-480 minute range exactly at its boundaries", () => {
    expect(topicSchema.safeParse({ ...valid, estimatedRevisionMinutes: 4 }).success).toBe(false);
    expect(topicSchema.safeParse({ ...valid, estimatedRevisionMinutes: 5 }).success).toBe(true);
    expect(topicSchema.safeParse({ ...valid, estimatedRevisionMinutes: 480 }).success).toBe(true);
    expect(topicSchema.safeParse({ ...valid, estimatedRevisionMinutes: 481 }).success).toBe(false);
  });

  it("rejects unknown difficulty and importance values", () => {
    expect(topicSchema.safeParse({ ...valid, difficulty: "impossible" }).success).toBe(false);
    expect(topicSchema.safeParse({ ...valid, importance: "urgent" }).success).toBe(false);
  });

  it("accepts every documented difficulty and importance value", () => {
    for (const difficulty of ["easy", "medium", "hard"]) {
      expect(topicSchema.safeParse({ ...valid, difficulty }).success).toBe(true);
    }
    for (const importance of ["low", "medium", "high"]) {
      expect(topicSchema.safeParse({ ...valid, importance }).success).toBe(true);
    }
  });
});

describe("completeRevisionSchema", () => {
  it("accepts a completion with or without a confidence rating", () => {
    expect(completeRevisionSchema.safeParse({ taskId: "task-1" }).success).toBe(true);
    expect(completeRevisionSchema.safeParse({ taskId: "task-1", confidence: "weak" }).success).toBe(true);
  });

  it("accepts every documented confidence level", () => {
    for (const confidence of ["strong", "okay", "weak"]) {
      expect(completeRevisionSchema.safeParse({ taskId: "task-1", confidence }).success).toBe(true);
    }
  });

  it("rejects an unknown confidence level", () => {
    expect(completeRevisionSchema.safeParse({ taskId: "task-1", confidence: "great" }).success).toBe(false);
  });
});

describe("mockTestSchema", () => {
  const valid = {
    name: "Mock Test 1",
    timeLimitMinutes: "30",
    marksPerCorrect: "2",
    negativeMarksPerIncorrect: "0.5",
    questionIds: ["q1", "q2"],
  };

  it("accepts a valid config and coerces form-string numbers", () => {
    const result = mockTestSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timeLimitMinutes).toBe(30);
      expect(result.data.marksPerCorrect).toBe(2);
      expect(result.data.negativeMarksPerIncorrect).toBe(0.5);
    }
  });

  it("requires at least one question — an empty test is meaningless", () => {
    expect(mockTestSchema.safeParse({ ...valid, questionIds: [] }).success).toBe(false);
  });

  it("enforces the duration range", () => {
    expect(mockTestSchema.safeParse({ ...valid, timeLimitMinutes: 0 }).success).toBe(false);
    expect(mockTestSchema.safeParse({ ...valid, timeLimitMinutes: 1 }).success).toBe(true);
    expect(mockTestSchema.safeParse({ ...valid, timeLimitMinutes: 300 }).success).toBe(true);
    expect(mockTestSchema.safeParse({ ...valid, timeLimitMinutes: 301 }).success).toBe(false);
  });

  it("requires positive marks per correct answer", () => {
    expect(mockTestSchema.safeParse({ ...valid, marksPerCorrect: 0 }).success).toBe(false);
    expect(mockTestSchema.safeParse({ ...valid, marksPerCorrect: -1 }).success).toBe(false);
  });

  it("allows zero negative marking but not a negative penalty", () => {
    expect(mockTestSchema.safeParse({ ...valid, negativeMarksPerIncorrect: 0 }).success).toBe(true);
    expect(mockTestSchema.safeParse({ ...valid, negativeMarksPerIncorrect: -0.5 }).success).toBe(false);
  });
});

describe("questionSetSchema", () => {
  it("accepts a name with an optional topic, including an empty topic string from a select", () => {
    expect(questionSetSchema.safeParse({ name: "Practice Set 1", topicId: "" }).success).toBe(true);
    expect(questionSetSchema.safeParse({ name: "Practice Set 1", topicId: "topic-1" }).success).toBe(true);
    expect(questionSetSchema.safeParse({ name: "Practice Set 1" }).success).toBe(true);
  });

  it("rejects a blank set name", () => {
    expect(questionSetSchema.safeParse({ name: "  " }).success).toBe(false);
  });
});

describe("draftQuestionSchema", () => {
  const valid = {
    questionId: "q-1",
    questionText: "Which account shows gross profit?",
    topicId: "",
    correctLabel: "A",
    options: [
      { id: "o-1", label: "A", text: "Trading Account" },
      { id: "o-2", label: "B", text: "Balance Sheet" },
    ],
  };

  it("accepts a well-formed reviewed question", () => {
    expect(draftQuestionSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a correct answer to be chosen before approval", () => {
    expect(draftQuestionSchema.safeParse({ ...valid, correctLabel: "" }).success).toBe(false);
  });

  it("requires at least two options — a single-option MCQ is not a question", () => {
    expect(draftQuestionSchema.safeParse({ ...valid, options: [valid.options[0]] }).success).toBe(false);
  });

  it("rejects blank question text or blank option text", () => {
    expect(draftQuestionSchema.safeParse({ ...valid, questionText: "   " }).success).toBe(false);
    expect(
      draftQuestionSchema.safeParse({
        ...valid,
        options: [valid.options[0], { id: "o-2", label: "B", text: "  " }],
      }).success
    ).toBe(false);
  });

  it("enforces length ceilings on question and option text", () => {
    expect(draftQuestionSchema.safeParse({ ...valid, questionText: "x".repeat(2001) }).success).toBe(false);
    expect(
      draftQuestionSchema.safeParse({
        ...valid,
        options: [valid.options[0], { id: "o-2", label: "B", text: "x".repeat(501) }],
      }).success
    ).toBe(false);
  });
});

describe("openaiApiKeySchema", () => {
  it("accepts a realistic OpenAI key", () => {
    expect(openaiApiKeySchema.safeParse({ apiKey: "sk-proj-abc123" }).success).toBe(true);
    expect(openaiApiKeySchema.safeParse({ apiKey: "sk-abc123" }).success).toBe(true);
  });

  it("rejects a key that isn't in OpenAI's format — catches pasting the wrong value", () => {
    expect(openaiApiKeySchema.safeParse({ apiKey: "my-password" }).success).toBe(false);
    expect(openaiApiKeySchema.safeParse({ apiKey: "pk-abc123" }).success).toBe(false);
  });

  it("rejects an empty key", () => {
    expect(openaiApiKeySchema.safeParse({ apiKey: "" }).success).toBe(false);
    expect(openaiApiKeySchema.safeParse({ apiKey: "   " }).success).toBe(false);
  });
});
