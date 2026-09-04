import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";

/**
 * Private local file storage for uploaded MCQ images (Document 08 §7, simplified for a
 * single-user local deployment — no cloud object storage is provisioned). Files live outside
 * the database and outside the public/ directory, under the repo-root /data/ folder, which is
 * gitignored and never served directly.
 */
const STORAGE_ROOT = path.join(process.cwd(), "data", "question-images");

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_FILE_BYTES = 12 * 1024 * 1024; // 12MB

export function isAllowedImageType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

export function isWithinSizeLimit(size: number): boolean {
  return size > 0 && size <= MAX_FILE_BYTES;
}

/** Saves a single uploaded image under a question set's private folder and returns its storage path. */
export async function saveQuestionImage(questionSetId: string, file: File): Promise<{ storagePath: string; absolutePath: string }> {
  const dir = path.join(STORAGE_ROOT, questionSetId);
  await fs.mkdir(dir, { recursive: true });

  const ext = path.extname(file.name) || ".jpg";
  const fileName = `${randomUUID()}${ext}`;
  const absolutePath = path.join(dir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absolutePath, buffer);

  return { storagePath: path.join("question-images", questionSetId, fileName), absolutePath };
}

export function resolveStoragePath(storagePath: string): string {
  return path.join(process.cwd(), "data", storagePath);
}

export async function readImageAsBase64(storagePath: string): Promise<string> {
  const buffer = await fs.readFile(resolveStoragePath(storagePath));
  return buffer.toString("base64");
}
