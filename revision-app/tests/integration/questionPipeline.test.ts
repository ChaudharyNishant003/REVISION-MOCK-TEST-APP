import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import { setupTestDatabase, resetDatabase } from "../setup/testDb";
import { createUser, createExam, createSyllabus, createQuestionSet, createQuestion } from "../fixtures/factories";

/**
 * The OpenAI client is mocked so the extraction *success* path can be verified without a
 * live API key — response parsing, error handling, and the prompt actually sent.
 */
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } };
  },
}));

const { extractQuestionsFromImage } = await import("@/lib/ai/extraction");

function openAiResponse(payload: unknown) {
  return { choices: [{ message: { content: JSON.stringify(payload) } }] };
}

describe("Question pipeline", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
    mockCreate.mockReset();
  });

  describe("AI extraction (OpenAI mocked)", () => {
    it("parses a well-formed extraction response into structured questions", async () => {
      mockCreate.mockResolvedValue(
        openAiResponse({
          questions: [
            {
              questionText: "Which account shows gross profit?",
              options: [
                { label: "A", text: "Trading Account" },
                { label: "B", text: "Balance Sheet" },
              ],
              correctLabel: "A",
              topicSuggestion: "Final Accounts",
              incomplete: false,
              confidence: 0.93,
            },
          ],
        })
      );

      const result = await extractQuestionsFromImage("sk-test-key", "fake-base64", "image/jpeg", ["Final Accounts"]);

      expect(result).toHaveLength(1);
      expect(result[0].questionText).toBe("Which account shows gross profit?");
      expect(result[0].options).toHaveLength(2);
      expect(result[0].correctLabel).toBe("A");
      expect(result[0].topicSuggestion).toBe("Final Accounts");
      expect(result[0].confidence).toBeCloseTo(0.93);
    });

    it("returns multiple questions from a single page image", async () => {
      mockCreate.mockResolvedValue(
        openAiResponse({
          questions: [
            { questionText: "Q1", options: [{ label: "A", text: "x" }], correctLabel: null, topicSuggestion: null, incomplete: false, confidence: 0.8 },
            { questionText: "Q2", options: [{ label: "A", text: "y" }], correctLabel: "A", topicSuggestion: null, incomplete: false, confidence: 0.9 },
          ],
        })
      );

      const result = await extractQuestionsFromImage("sk-test-key", "fake-base64", "image/jpeg", []);
      expect(result).toHaveLength(2);
    });

    it("preserves a null correct answer rather than inventing one", async () => {
      mockCreate.mockResolvedValue(
        openAiResponse({
          questions: [
            { questionText: "No answer key visible", options: [{ label: "A", text: "x" }], correctLabel: null, topicSuggestion: null, incomplete: false, confidence: 0.7 },
          ],
        })
      );

      const result = await extractQuestionsFromImage("sk-test-key", "fake-base64", "image/jpeg", []);
      expect(result[0].correctLabel).toBeNull();
    });

    it("carries the incomplete flag through for unreadable questions", async () => {
      mockCreate.mockResolvedValue(
        openAiResponse({
          questions: [
            { questionText: "Cut off at the page edge…", options: [{ label: "A", text: "x" }], correctLabel: null, topicSuggestion: null, incomplete: true, confidence: 0.3 },
          ],
        })
      );

      const result = await extractQuestionsFromImage("sk-test-key", "fake-base64", "image/jpeg", []);
      expect(result[0].incomplete).toBe(true);
    });

    it("sends the syllabus topic names to the model so it can suggest a match", async () => {
      mockCreate.mockResolvedValue(openAiResponse({ questions: [] }));

      await extractQuestionsFromImage("sk-test-key", "fake-base64", "image/jpeg", ["Depreciation", "Input Tax Credit"]);

      const payload = mockCreate.mock.calls[0][0];
      const promptText = JSON.stringify(payload);
      expect(promptText).toContain("Depreciation");
      expect(promptText).toContain("Input Tax Credit");
    });

    it("sends the image as a data URL with the right mime type", async () => {
      mockCreate.mockResolvedValue(openAiResponse({ questions: [] }));

      await extractQuestionsFromImage("sk-test-key", "BASE64DATA", "image/png", []);

      const payload = JSON.stringify(mockCreate.mock.calls[0][0]);
      expect(payload).toContain("data:image/png;base64,BASE64DATA");
    });

    it("requests a strict structured-output schema so the response can be trusted", async () => {
      mockCreate.mockResolvedValue(openAiResponse({ questions: [] }));

      await extractQuestionsFromImage("sk-test-key", "fake-base64", "image/jpeg", []);

      const payload = mockCreate.mock.calls[0][0] as { response_format?: { type?: string } };
      expect(payload.response_format?.type).toBe("json_schema");
    });

    it("throws a clear error when the model returns an empty response", async () => {
      mockCreate.mockResolvedValue({ choices: [{ message: { content: "" } }] });

      await expect(extractQuestionsFromImage("sk-test-key", "fake-base64", "image/jpeg", [])).rejects.toThrow(/empty response/i);
    });

    it("throws when the response is missing the questions array", async () => {
      mockCreate.mockResolvedValue(openAiResponse({ notQuestions: [] }));

      await expect(extractQuestionsFromImage("sk-test-key", "fake-base64", "image/jpeg", [])).rejects.toThrow(/questions array/i);
    });

    it("propagates an API failure rather than silently returning nothing", async () => {
      mockCreate.mockRejectedValue(new Error("429 rate limit exceeded"));

      await expect(extractQuestionsFromImage("sk-test-key", "fake-base64", "image/jpeg", [])).rejects.toThrow(/rate limit/i);
    });
  });

  describe("review lifecycle", () => {
    async function setupSet() {
      const user = await createUser();
      const exam = await createExam(user.id);
      const { topics } = await createSyllabus(exam.id, [{ name: "Depreciation" }]);
      const set = await createQuestionSet(exam.id);
      return { user, exam, set, topic: topics[0] };
    }

    it("keeps extracted questions out of the bank until a human approves them", async () => {
      const { exam, set } = await setupSet();
      await createQuestion(set.id, {
        text: "Freshly extracted",
        options: ["A", "B"],
        correctIndex: 0,
        approvalStatus: "needs_review",
      });

      const inBank = await prisma.question.findMany({
        where: { questionSet: { examId: exam.id }, approvalStatus: "approved" },
      });
      expect(inBank).toHaveLength(0);
    });

    it("moves an approved question into the bank with its confirmed answer", async () => {
      const { exam, set } = await setupSet();
      const draft = await createQuestion(set.id, {
        text: "Under review",
        options: ["Right", "Wrong"],
        correctIndex: 0,
        approvalStatus: "needs_review",
      });

      await prisma.question.update({
        where: { id: draft.id },
        data: { approvalStatus: "approved" },
      });

      const inBank = await prisma.question.findMany({
        where: { questionSet: { examId: exam.id }, approvalStatus: "approved", correctOptionId: { not: null } },
      });
      expect(inBank.map((q) => q.id)).toContain(draft.id);
    });

    it("keeps a rejected question out of the bank permanently", async () => {
      const { exam, set } = await setupSet();
      const draft = await createQuestion(set.id, {
        text: "Bad extraction",
        options: ["A", "B"],
        correctIndex: 0,
        approvalStatus: "needs_review",
      });

      await prisma.question.update({ where: { id: draft.id }, data: { approvalStatus: "rejected" } });

      const inBank = await prisma.question.findMany({
        where: { questionSet: { examId: exam.id }, approvalStatus: "approved" },
      });
      expect(inBank.map((q) => q.id)).not.toContain(draft.id);
    });

    it("records AI confidence and a review flag alongside the question", async () => {
      const { set } = await setupSet();
      const question = await createQuestion(set.id, {
        text: "Low confidence extraction",
        options: ["A", "B"],
        correctIndex: 0,
        approvalStatus: "needs_review",
      });

      await prisma.questionExtractionMetadata.create({
        data: { questionId: question.id, aiConfidence: 0.42, requiresReview: true },
      });

      const metadata = await prisma.questionExtractionMetadata.findUniqueOrThrow({
        where: { questionId: question.id },
      });
      expect(metadata.aiConfidence).toBeCloseTo(0.42);
      expect(metadata.requiresReview).toBe(true);
    });

    it("tracks each image's processing state independently", async () => {
      const { set } = await setupSet();
      const good = await prisma.questionSourceImage.create({
        data: { questionSetId: set.id, storagePath: "a.jpg", originalFileName: "a.jpg", mimeType: "image/jpeg", processingStatus: "completed" },
      });
      const bad = await prisma.questionSourceImage.create({
        data: { questionSetId: set.id, storagePath: "b.jpg", originalFileName: "b.jpg", mimeType: "image/jpeg", processingStatus: "failed", errorMessage: "No OpenAI API key is configured." },
      });

      // One bad photo must not affect the other image's state.
      expect((await prisma.questionSourceImage.findUniqueOrThrow({ where: { id: good.id } })).processingStatus).toBe("completed");
      const failed = await prisma.questionSourceImage.findUniqueOrThrow({ where: { id: bad.id } });
      expect(failed.processingStatus).toBe("failed");
      expect(failed.errorMessage).toContain("API key");
    });

    it("cascades questions away when their question set is deleted", async () => {
      const { set } = await setupSet();
      await createQuestion(set.id, { text: "Q", options: ["A", "B"], correctIndex: 0 });

      await prisma.questionSet.delete({ where: { id: set.id } });

      expect(await prisma.question.count({ where: { questionSetId: set.id } })).toBe(0);
    });
  });
});
