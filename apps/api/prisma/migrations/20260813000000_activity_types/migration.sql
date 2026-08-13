CREATE TYPE "ActivityType" AS ENUM ('QUIZ', 'POLL', 'WORD_CLOUD');

ALTER TABLE "Quiz" ADD COLUMN "type" "ActivityType" NOT NULL DEFAULT 'QUIZ';

CREATE TABLE "WordCloudEntry" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "normalizedText" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WordCloudEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WordCloudVote" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WordCloudVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WordCloudEntry_roomId_questionId_normalizedText_key" ON "WordCloudEntry"("roomId", "questionId", "normalizedText");
CREATE INDEX "WordCloudEntry_roomId_questionId_idx" ON "WordCloudEntry"("roomId", "questionId");
CREATE UNIQUE INDEX "WordCloudVote_participantId_entryId_key" ON "WordCloudVote"("participantId", "entryId");
CREATE INDEX "WordCloudVote_entryId_idx" ON "WordCloudVote"("entryId");

ALTER TABLE "WordCloudEntry" ADD CONSTRAINT "WordCloudEntry_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WordCloudEntry" ADD CONSTRAINT "WordCloudEntry_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WordCloudVote" ADD CONSTRAINT "WordCloudVote_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WordCloudEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WordCloudVote" ADD CONSTRAINT "WordCloudVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
