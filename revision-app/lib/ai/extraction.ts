import OpenAI from "openai";

/**
 * MCQ extraction from a single uploaded image (Document 06 §4-9, Document 03 §5-7).
 * The model returns structured, machine-readable data only — the backend validates and
 * decides everything else (topic mapping, approval, correct-answer confirmation).
 */

export class OpenAIKeyMissingError extends Error {
  constructor() {
    super("No OpenAI API key is configured. Add one in Settings, or set OPENAI_API_KEY on the server.");
    this.name = "OpenAIKeyMissingError";
  }
}

export type ExtractedOption = { label: string; text: string };

export type ExtractedQuestion = {
  questionText: string;
  options: ExtractedOption[];
  /** Option label the source visibly marks correct, or null if no answer is present in the source. */
  correctLabel: string | null;
  /** Free-text guess at an existing syllabus topic name, or null if no confident match. */
  topicSuggestion: string | null;
  /** True if the model could not read the question/options/answer cleanly. */
  incomplete: boolean;
  /** Model's own confidence in this extraction, 0-1. */
  confidence: number;
};

const RESPONSE_SCHEMA = {
  name: "mcq_extraction",
  schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            questionText: { type: "string" },
            options: {
              type: "array",
              items: {
                type: "object",
                properties: { label: { type: "string" }, text: { type: "string" } },
                required: ["label", "text"],
                additionalProperties: false,
              },
            },
            correctLabel: { type: ["string", "null"] },
            topicSuggestion: { type: ["string", "null"] },
            incomplete: { type: "boolean" },
            confidence: { type: "number" },
          },
          required: ["questionText", "options", "correctLabel", "topicSuggestion", "incomplete", "confidence"],
          additionalProperties: false,
        },
      },
    },
    required: ["questions"],
    additionalProperties: false,
  },
  strict: true,
} as const;

function buildPrompt(topicNames: string[]): string {
  return [
    "Extract every multiple-choice question (MCQ) visible in this image of study material.",
    "Rules:",
    "- Extract only MCQs that are actually visible in the image. Never invent questions, options, or answers.",
    "- Preserve the original wording, numbers, and formulas exactly as written — accounting questions can flip meaning on a single digit.",
    "- Extract every visible option in its original order.",
    "- A single image may contain multiple separate questions; do not merge them.",
    "- If a question's text or options are cut off or illegible, set incomplete: true rather than guessing.",
    "- Only set correctLabel if the correct answer is visibly marked/indicated in the source (e.g. underlined, circled, or given as an answer key). If no answer is visible, correctLabel must be null — do not guess.",
    topicNames.length > 0
      ? `- For topicSuggestion, pick the closest matching name from this exact list if one clearly fits, otherwise use null. Do not invent new topic names: ${topicNames.join(", ")}`
      : "- Set topicSuggestion to null (no syllabus topics exist yet to match against).",
    "- confidence is your own 0-1 confidence in the accuracy of this specific extraction.",
  ].join("\n");
}

export async function extractQuestionsFromImage(
  apiKey: string,
  base64Image: string,
  mimeType: string,
  topicNames: string[]
): Promise<ExtractedQuestion[]> {
  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: buildPrompt(topicNames) },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
        ],
      },
    ],
    response_format: { type: "json_schema", json_schema: RESPONSE_SCHEMA },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned an empty response");

  const parsed = JSON.parse(raw) as { questions: ExtractedQuestion[] };
  if (!Array.isArray(parsed.questions)) throw new Error("OpenAI response did not include a questions array");

  return parsed.questions;
}
