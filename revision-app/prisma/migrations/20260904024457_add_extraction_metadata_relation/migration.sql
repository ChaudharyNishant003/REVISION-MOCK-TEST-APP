-- CreateTable
CREATE TABLE "AiProcessingJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionSetId" TEXT NOT NULL,
    "sourceImageId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL DEFAULT 'mcq_extraction',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "QuestionExtractionMetadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "aiConfidence" REAL,
    "rawExtractionReference" TEXT,
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionExtractionMetadata_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiProcessingJob_questionSetId_idx" ON "AiProcessingJob"("questionSetId");

-- CreateIndex
CREATE INDEX "AiProcessingJob_sourceImageId_idx" ON "AiProcessingJob"("sourceImageId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionExtractionMetadata_questionId_key" ON "QuestionExtractionMetadata"("questionId");
