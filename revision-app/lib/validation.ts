import { z } from "zod";

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const IMPORTANCE_LEVELS = ["low", "medium", "high"] as const;
export const CONFIDENCE_LEVELS = ["strong", "okay", "weak"] as const;
export const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6] as const; // 0 = Sunday

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const examSetupSchema = z.object({
  name: z.string().trim().min(1, "Exam name is required").max(120),
  examDate: z.coerce.date().refine((d) => d.getTime() > Date.now(), {
    message: "Exam date must be in the future",
  }),
});

export const availabilitySlotSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
  })
  .refine((slot) => slot.startTime < slot.endTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const subjectSchema = z.object({
  name: z.string().trim().min(1, "Subject name is required").max(120),
});

export const chapterSchema = z.object({
  subjectId: z.string().min(1),
  name: z.string().trim().min(1, "Chapter name is required").max(120),
});

export const topicSchema = z.object({
  chapterId: z.string().min(1),
  name: z.string().trim().min(1, "Topic name is required").max(160),
  estimatedRevisionMinutes: z.coerce.number().int().min(5).max(480).default(30),
  difficulty: z.enum(DIFFICULTIES).default("medium"),
  importance: z.enum(IMPORTANCE_LEVELS).default("medium"),
});

export const completeRevisionSchema = z.object({
  taskId: z.string().min(1),
  confidence: z.enum(CONFIDENCE_LEVELS).optional(),
});

export const mockTestSchema = z.object({
  name: z.string().trim().min(1, "Test name is required").max(120),
  timeLimitMinutes: z.coerce.number().int().min(1, "Duration must be at least 1 minute").max(300),
  marksPerCorrect: z.coerce.number().min(0.01, "Marks per correct answer must be positive").max(100),
  negativeMarksPerIncorrect: z.coerce.number().min(0, "Negative marks can't be negative").max(100),
  questionIds: z.array(z.string().min(1)).min(1, "Select at least one question"),
});

export const questionSetSchema = z.object({
  name: z.string().trim().min(1, "Question set name is required").max(120),
  topicId: z.string().min(1).optional().or(z.literal("")),
});

export const openaiApiKeySchema = z.object({
  apiKey: z.string().trim().min(1).refine((val) => val.startsWith("sk-"), "OpenAI API keys start with \"sk-\""),
});

export const draftQuestionSchema = z.object({
  questionId: z.string().min(1),
  questionText: z.string().trim().min(1, "Question text is required").max(2000),
  topicId: z.string().min(1).optional().or(z.literal("")),
  correctLabel: z.string().min(1, "Select the correct option"),
  options: z
    .array(z.object({ id: z.string().min(1).optional(), label: z.string().min(1), text: z.string().trim().min(1, "Option text can't be empty").max(500) }))
    .min(2, "At least two options are required"),
});
