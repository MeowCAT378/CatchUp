-- Existing entries cannot be truthfully attributed; keep them null and require the app to set all new rows.
ALTER TABLE "WordCloudEntry" ADD COLUMN "participantId" TEXT;

CREATE UNIQUE INDEX "WordCloudEntry_roomId_questionId_participantId_key"
ON "WordCloudEntry"("roomId", "questionId", "participantId");

CREATE INDEX "WordCloudEntry_participantId_idx"
ON "WordCloudEntry"("participantId");

ALTER TABLE "WordCloudEntry"
ADD CONSTRAINT "WordCloudEntry_participantId_fkey"
FOREIGN KEY ("participantId") REFERENCES "Participant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
